import axios from 'axios';
import Job from '../models/Job.model.js';
import logger from '../utils/logger.js';

/**
 * Remotive Jobs
 */
const fetchRemotiveJobs = async () => {
  const response = await axios.get(
    'https://remotive.com/api/remote-jobs',
    {
      params: {
        limit: 100,
        category: 'software-dev',
      },
      timeout: 10000,
    }
  );

  return response.data.jobs || [];
};

/**
 * Arbeitnow Jobs
 */
const fetchArbeitnowJobs = async () => {
  const response = await axios.get(
    'https://www.arbeitnow.com/api/job-board-api',
    {
      timeout: 10000,
    }
  );

  return response.data.data || [];
};

/**
 * Jobicy Jobs
 */
const fetchJobicyJobs = async () => {
  const response = await axios.get(
    'https://jobicy.com/api/v2/remote-jobs',
    {
      params: {
        count: 50,
        tag: 'developer',
      },
      timeout: 10000,
    }
  );

  return response.data.jobs || [];
};

/**
 * Normalize all providers into one schema
 */
const normalizeJob = (job, source) => {
  switch (source) {
    case 'remotive':
      return {
        externalId: `remotive-${job.id}`,
        title: job.title,
        company: job.company_name,
        description: job.description,
        url: job.url,
        category: [job.category],
        tags: job.tags || [],
        source: 'remotive',
        jobType: 'remote',
        createdAt: new Date(job.publication_date),
        status: 'open',
      };

    case 'arbeitnow':
      return {
        externalId: `arbeitnow-${job.slug}`,
        title: job.title,
        company: job.company_name,
        description: job.description,
        url: job.url,
        category: job.tags || [],
        tags: job.tags || [],
        source: 'arbeitnow',
        jobType: 'remote',
        createdAt: new Date(),
        status: 'open',
      };

    case 'jobicy':
      return {
        externalId: `jobicy-${job.id}`,
        title: job.jobTitle,
        company: job.companyName,
        description: job.jobDescription,
        url: job.url,
        category: job.jobCategory
          ? [job.jobCategory]
          : [],
        tags: job.jobTags || [],
        source: 'jobicy',
        jobType: 'remote',
        createdAt: new Date(job.pubDate),
        status: 'open',
      };

    default:
      return null;
  }
};

/**
 * Main sync
 */
const fetchAllJobs = async () => {
  const stats = {
    totalFetched: 0,
    newJobsCreated: 0,
    duplicatesSkipped: 0,
    errors: [],
  };

  try {
    const [remotive, arbeitnow, jobicy] =
      await Promise.allSettled([
        fetchRemotiveJobs(),
        fetchArbeitnowJobs(),
        fetchJobicyJobs(),
      ]);

    const jobs = [];

    if (remotive.status === 'fulfilled') {
      jobs.push(
        ...remotive.value.map(job =>
          normalizeJob(job, 'remotive')
        )
      );
    }

    if (arbeitnow.status === 'fulfilled') {
      jobs.push(
        ...arbeitnow.value.map(job =>
          normalizeJob(job, 'arbeitnow')
        )
      );
    }

    if (jobicy.status === 'fulfilled') {
      jobs.push(
        ...jobicy.value.map(job =>
          normalizeJob(job, 'jobicy')
        )
      );
    }

    stats.totalFetched = jobs.length;

    for (const job of jobs) {
      try {
        const exists = await Job.findOne({
          externalId: job.externalId,
        });

        if (exists) {
          stats.duplicatesSkipped++;
          continue;
        }

        await Job.create(job);
        stats.newJobsCreated++;
      } catch (err) {
        stats.errors.push(err.message);
      }
    }

    logger.info('Job sync completed', stats);

    return stats;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

export {
  fetchAllJobs,
  fetchRemotiveJobs,
  fetchArbeitnowJobs,
  fetchJobicyJobs,
};