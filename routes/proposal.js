const express = require('express');
const Proposal = require('../models/Proposal');
const JobMatch = require('../models/JobMatch');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate proposal for a job match
router.post('/generate', auth, async (req, res) => {
  try {
    const { job_match_id, tone = 'professional' } = req.body;
    
    if (!job_match_id) {
      return res.status(400).json({ error: 'Job match ID is required' });
    }

    // Check if job match exists and belongs to user
    const jobMatch = await JobMatch.findByUserIdAndJobMatch(req.user.id, job_match_id);
    
    if (!jobMatch) {
      return res.status(404).json({ error: 'Job match not found' });
    }

    // Check if proposal already exists
    const existingProposal = await Proposal.findByUserAndJobMatch(req.user.id, job_match_id);
    
    if (existingProposal) {
      return res.status(409).json({ 
        error: 'Proposal already exists for this job match',
        proposal: existingProposal
      });
    }

    // Generate proposal content (this would normally use AI)
    const proposalContent = await generateProposalContent(jobMatch, req.user, tone);

    // Create proposal
    const proposal = await Proposal.create(req.user.id, job_match_id, proposalContent, tone);

    res.status(201).json({
      message: 'Proposal generated successfully',
      proposal: {
        id: proposal.id,
        job_match_id: proposal.job_match_id,
        content: proposal.content,
        tone: proposal.tone,
        created_at: proposal.created_at,
        job_title: jobMatch.title,
        job_subreddit: jobMatch.subreddit
      }
    });
  } catch (error) {
    console.error('Generate proposal error:', error);
    res.status(500).json({ error: 'Failed to generate proposal' });
  }
});

// Get user proposals
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const proposals = await Proposal.findByUserId(req.user.id, parseInt(limit), parseInt(offset));

    res.json({
      proposals: proposals.map(proposal => ({
        id: proposal.id,
        job_match_id: proposal.job_match_id,
        content: proposal.content,
        tone: proposal.tone,
        created_at: proposal.created_at,
        updated_at: proposal.updated_at,
        job_title: proposal.title,
        job_subreddit: proposal.subreddit,
        match_score: proposal.match_score,
        job_posted_at: proposal.posted_at
      }))
    });
  } catch (error) {
    console.error('Get proposals error:', error);
    res.status(500).json({ error: 'Failed to get proposals' });
  }
});

// Get today's proposals
router.get('/today', auth, async (req, res) => {
  try {
    const proposals = await Proposal.getTodayProposals(req.user.id);

    res.json({
      proposals: proposals.map(proposal => ({
        id: proposal.id,
        job_match_id: proposal.job_match_id,
        content: proposal.content,
        tone: proposal.tone,
        created_at: proposal.created_at,
        job_title: proposal.title,
        job_subreddit: proposal.subreddit,
        match_score: proposal.match_score
      }))
    });
  } catch (error) {
    console.error('Get today proposals error:', error);
    res.status(500).json({ error: 'Failed to get today proposals' });
  }
});

// Get recent proposals
router.get('/recent', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const proposals = await Proposal.getRecentProposals(req.user.id, parseInt(limit));

    res.json({
      proposals: proposals.map(proposal => ({
        id: proposal.id,
        job_match_id: proposal.job_match_id,
        content: proposal.content,
        tone: proposal.tone,
        created_at: proposal.created_at,
        job_title: proposal.title,
        job_subreddit: proposal.subreddit,
        match_score: proposal.match_score
      }))
    });
  } catch (error) {
    console.error('Get recent proposals error:', error);
    res.status(500).json({ error: 'Failed to get recent proposals' });
  }
});

// Get proposal by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const proposal = await Proposal.findById(parseInt(id));
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Check if proposal belongs to user
    if (proposal.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      proposal: {
        id: proposal.id,
        job_match_id: proposal.job_match_id,
        content: proposal.content,
        tone: proposal.tone,
        created_at: proposal.created_at,
        updated_at: proposal.updated_at,
        job_title: proposal.job_title,
        job_subreddit: proposal.job_subreddit
      }
    });
  } catch (error) {
    console.error('Get proposal error:', error);
    res.status(500).json({ error: 'Failed to get proposal' });
  }
});

// Update proposal
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, tone } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const proposal = await Proposal.findById(parseInt(id));
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Check if proposal belongs to user
    if (proposal.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedProposal = await Proposal.update(parseInt(id), content, tone);

    res.json({
      message: 'Proposal updated successfully',
      proposal: {
        id: updatedProposal.id,
        job_match_id: updatedProposal.job_match_id,
        content: updatedProposal.content,
        tone: updatedProposal.tone,
        updated_at: updatedProposal.updated_at
      }
    });
  } catch (error) {
    console.error('Update proposal error:', error);
    res.status(500).json({ error: 'Failed to update proposal' });
  }
});

// Delete proposal
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const proposal = await Proposal.findById(parseInt(id));
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Check if proposal belongs to user
    if (proposal.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = await Proposal.delete(parseInt(id));
    
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete proposal' });
    }

    res.json({ message: 'Proposal deleted successfully' });
  } catch (error) {
    console.error('Delete proposal error:', error);
    res.status(500).json({ error: 'Failed to delete proposal' });
  }
});

// Helper function to generate proposal content (AI simulation)
async function generateProposalContent(jobMatch, user, tone) {
  const jobTitle = jobMatch.title;
  const jobBody = jobMatch.body;
  const userName = user.name;
  
  // This would normally call OpenAI API
  // For now, we'll generate a template-based proposal
  const templates = {
    professional: `Dear Hiring Manager,

I am writing to express my strong interest in the ${jobTitle} position. With my skills and experience, I believe I would be an excellent fit for this role.

${userName}`,
    casual: `Hi there!

I saw your post about the ${jobTitle} position and I'm really interested. I think my skills would be a great match for what you're looking for.

Best,
${userName}`,
    enthusiastic: `Hello! I'm incredibly excited about the ${jobTitle} opportunity! This role sounds like a perfect match for my skills and passion.

Looking forward to discussing how I can contribute to your team!

Best regards,
${userName}`
  };

  return templates[tone] || templates.professional;
}

module.exports = router;
