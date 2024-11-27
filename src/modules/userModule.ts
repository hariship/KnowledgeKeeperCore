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
  let currentOriginalTable = '';
  let currentModifiedTable = '';
  let insideTable = false;

  // Normalize text to minimize noise from whitespace and formatting differences
  const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim();

  // Parse HTML to clean and validate structure
  const cleanHTML = (html: string) => parse(html).toString();

  // Ensure input HTML strings are clean and well-structured
  html1 = cleanHTML(html1);
  html2 = cleanHTML(html2);

  differences.forEach((part) => {
      const headingMatch = part.value.match(/<(h[1-4])[^>]*>(.*?)<\/\1>/i);

      // Handle headings (h1 to h4)
      if (headingMatch) {
          const headingTag = headingMatch[1];
          const headingText = normalizeWhitespace(headingMatch[2]);
          headingLevels[`section_main_heading_${headingTag.charAt(1)}`] = headingText;

          // Clear deeper heading levels when encountering a higher-level heading
          for (let i = parseInt(headingTag.charAt(1)) + 1; i <= 4; i++) {
              delete headingLevels[`section_main_heading_${i}`];
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
                  type: currentOriginalTable && currentModifiedTable ? 'modified' : currentOriginalTable ? 'removed' : 'added',
                  original_content: normalizeWhitespace(currentOriginalTable),
                  modified_content: normalizeWhitespace(currentModifiedTable),
              });

              currentOriginalTable = '';
              currentModifiedTable = '';
          }
      }
      // Handle images (added or removed)
      else if ((part.added || part.removed) && /<img/i.test(part.value)) {
          structuredDiff.push({
              ...headingLevels,
              type: part.added ? 'added' : 'removed',
              original_content: part.removed ? normalizeWhitespace(part.value) : '',
              modified_content: part.added ? normalizeWhitespace(part.value) : '',
          });
      }
      // Handle paragraphs, plain text, and other differences
      else if (part.added || part.removed) {
          structuredDiff.push({
              ...headingLevels,
              type: part.added ? 'added' : 'removed',
              original_content: part.removed ? normalizeWhitespace(part.value) : '',
              modified_content: part.added ? normalizeWhitespace(part.value) : '',
          });
      }
  });

  return structuredDiff;
}