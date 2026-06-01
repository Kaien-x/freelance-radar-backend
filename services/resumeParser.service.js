const fs = require('fs');
const pdfParseImport = require('pdf-parse');
const PDFParse = pdfParseImport?.PDFParse || pdfParseImport?.default?.PDFParse;
const pdfParseFn = typeof pdfParseImport === 'function' ? pdfParseImport : pdfParseImport?.default;
const { extractSkillsFromText } = require('../utils/skillExtractor');

const parseResume = async (filePath) => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const dataBuffer = Buffer.isBuffer(fileBuffer) ? new Uint8Array(fileBuffer) : fileBuffer;

    let pdfData;
    if (typeof pdfParseFn === 'function') {
      pdfData = await pdfParseFn({ data: dataBuffer });
    } else if (typeof PDFParse === 'function') {
      const parser = new PDFParse({ data: dataBuffer });
      pdfData = await parser.getText();
    } else {
      throw new Error('pdf-parse module did not export a usable parser');
    }

    const text = typeof pdfData === 'string' ? pdfData : pdfData.text || '';

    const extractedSkills = extractSkillsFromText(text);

    return {
      text,
      extractedSkills
    };
  } catch (error) {
    console.error('Resume parsing error:', error);

    return {
      text: '',
      extractedSkills: {
        frontend: [],
        backend: [],
        databases: [],
        devops: [],
        tools: [],
        ai: [],
        other: []
      }
    };
  }
};

module.exports = {
  parseResume
};