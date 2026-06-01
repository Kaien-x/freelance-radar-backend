const OpenAI = require('openai');

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const TONE_GUIDE = {
  professional: 'Professional and confident. Business-appropriate language. Clear and direct.',
  friendly: 'Warm and approachable. Conversational but still credible. First-name basis energy.',
  technical: 'Technical and precise. Reference specific technologies, frameworks, and methodologies. Show deep expertise.',
  creative: 'Creative and energetic. Stand out with personality while staying relevant to the job.',
};

const generateProposal = async ({ jobTitle, jobDescription, userSkills, userBio, tone = 'professional' }) => {
  const skills = Array.isArray(userSkills)
    ? userSkills.map(s => (typeof s === 'string' ? s : s.skill)).join(', ')
    : userSkills || 'various skills';

  const systemPrompt = `You are an expert freelance proposal writer. ${TONE_GUIDE[tone]}
Rules:
- 150 to 200 words maximum
- Do NOT open with "I am interested in your project" or "I am writing to apply"
- Open with something specific from the job description
- Mention 1-2 directly relevant skills or past experiences
- End with a clear, low-friction call to action
- Sound like a real human, not a template
- No buzzwords: no "passionate", "leverage", "synergy", "cutting-edge"
- Return ONLY the proposal text, nothing else`;

  const userPrompt = `Write a freelance proposal for this job.

JOB TITLE: ${jobTitle}
JOB DESCRIPTION: ${jobDescription}

MY SKILLS: ${skills}
MY BACKGROUND: ${userBio || 'Experienced freelance developer'}

Write the proposal now:`;

  if (!openai) {
    // Placeholder for development without API key
    return `Based on your need for ${jobTitle}, I can help you achieve exactly what you're looking for.

With experience in ${skills}, I've worked on similar projects that required the same level of attention to detail and technical precision you've described.

One specific thing that stands out to me from your description is [key requirement] — I've handled this directly in past projects and can bring that same approach here.

I'd love to discuss the project further and understand your timeline. Would you be open to a quick 15-minute call this week?`;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 400,
    temperature: 0.82,
  });

  return response.choices[0].message.content.trim();
};

const matchJobsToUser = async (user, jobs) => {
  const userSkills = user.skills?.map(s => s.skill) || [];
  
  return jobs.map(job => {
    const jobSkills = job.skills || [];
    const matchedSkills = jobSkills.filter(skill =>
      userSkills.some(us => us.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(us.toLowerCase()))
    );
    const score = jobSkills.length > 0 ? Math.round((matchedSkills.length / jobSkills.length) * 100) : 0;
    return { ...job.toObject(), matchScore: score, matchedSkills };
  }).sort((a, b) => b.matchScore - a.matchScore);
};

module.exports = { generateProposal, matchJobsToUser };
