import jwt from 'jsonwebtoken';
import { diffWordsWithSpace } from 'diff';
import { parse } from 'node-html-parser'; // Install via `npm install node-html-parser`


export const generateToken = (user: any) => {
    const JWT_SECRET = process.env.JWT_SECRET || "custom_jwt";
    let signedtoken =  jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '48h' });
    return signedtoken;
};

export async function getDiffWordsWithSpace(html1: string, html2: string) {
  const differences = diffWordsWithSpace(html1, html2);
  const structuredDiff: any[] = [];
  const headingLevels: { [key: string]: string } = {};
  const prevHeadingLevels: { [key: string]: string } = {}; // Store previous heading levels
  let currentOriginalTable = '';
  let currentModifiedTable = '';
  let insideTable = false;

  // Helper: Normalize text to minimize noise from whitespace and formatting differences
  const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim();

  // Helper: Parse and validate HTML structure
  const cleanHTML = (html: string) => {
      const root = parse(html, {
          lowerCaseTagName: true, // Convert all tags to lowercase
          comment: false,        // Remove comments
          blockTextElements: { script: false, style: false }, // Handle script and style tags
      });
      return root.toString();
  };

  // Helper: Fix unclosed tags
  const validateHTML = (content: string) => {
      try {
          const root = parse(content, { lowerCaseTagName: true });
          return root.toString(); // If valid, return cleaned content
      } catch (error) {
          console.warn('Invalid HTML found:', content);
          return content.replace(/<[^>]*$/, ''); // Remove unclosed tag fragments
      }
  };

  // Ensure input HTML strings are clean and well-structured
  html1 = cleanHTML(html1);
  html2 = cleanHTML(html2);

  console.log('Cleaned HTML1:', html1);
  console.log('Cleaned HTML2:', html2);
  console.log('Differences:', differences);

  differences.forEach((part) => {
      const headingMatch = part.value.match(/<(h[1-4])[^>]*>(.*?)<\/\1>/i);

      // Handle headings (h1 to h4)
      if (headingMatch) {
          const headingTag = headingMatch[1];
          const headingText = normalizeWhitespace(headingMatch[2]);
          const level = parseInt(headingTag.charAt(1));

          // Update previous heading levels
          for (let i = 1; i <= 4; i++) {
              prevHeadingLevels[`prev_section_main_heading${i}`] = headingLevels[`section_main_heading_${i}`] || "";
          }

          // Update current heading levels
          headingLevels[`section_main_heading_${level}`] = headingText;

          // Clear deeper heading levels when encountering a higher-level heading
          for (let i = level + 1; i <= 4; i++) {
              headingLevels[`section_main_heading_${i}`] = "";
          }
      }
      // Handle tables
      else if (part.value.includes('<table')) {
          insideTable = true;
          currentOriginalTable = '';
          currentModifiedTable = '';
      }

      if (insideTable) {
          if (part.added) {
              currentModifiedTable += part.value;
          } else if (part.removed) {
              currentOriginalTable += part.value;
          } else {
              currentOriginalTable += part.value;
              currentModifiedTable += part.value;
          }

          if (part.value.includes('</table>')) {
              insideTable = false;
              structuredDiff.push({
                  ...headingLevels,
                  ...prevHeadingLevels,
                  type: currentOriginalTable && currentModifiedTable ? 'modified' : currentOriginalTable ? 'deleted' : 'added',
                  original_content: validateHTML(currentOriginalTable),
                  modified_content: validateHTML(currentModifiedTable),
              });

              currentOriginalTable = '';
              currentModifiedTable = '';
          }
      }
      // Handle images (added or removed)
      else if ((part.added || part.removed) && /<img/i.test(part.value)) {
          structuredDiff.push({
              ...headingLevels,
              ...prevHeadingLevels,
              type: part.added ? 'added' : 'deleted',
              original_content: part.removed ? validateHTML(part.value) : '',
              modified_content: part.added ? validateHTML(part.value) : '',
          });
      }
      // Handle paragraphs, plain text, and other differences
      else if (part.added || part.removed) {
          const contentType = part.added ? 'added' : 'deleted';

          structuredDiff.push({
              ...headingLevels,
              ...prevHeadingLevels,
              type: contentType,
              original_content: part.removed ? validateHTML(part.value) : '',
              modified_content: part.added ? validateHTML(part.value) : '',
          });
      }
  });

  console.log('Structured Diff:', structuredDiff);

  return structuredDiff;
}