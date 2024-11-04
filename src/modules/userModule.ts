import jwt from 'jsonwebtoken';
import { diffWordsWithSpace } from 'diff';


export const generateToken = (user: any) => {
    const JWT_SECRET = process.env.JWT_SECRET || "custom_jwt";
    let signedtoken =  jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '48h' });
    return signedtoken;
};

export async function getDiffWordsWithSpace(html1: string, html2: string) {
    const differences = diffWordsWithSpace(html1, html2);
    const structuredDiff: any[] = [];
    const headingLevels: { [key: string]: string } = {}; // Track current headings by level
    let currentOriginalTable = ''; // Capture original table content
    let currentModifiedTable = ''; // Capture modified table content
    let insideTable = false; // Track if we're within a table element
  
    differences.forEach(part => {
      const headingMatch = part.value.match(/<(h[1-4])[^>]*>(.*?)<\/\1>/i);
  
      // Update heading levels based on the current heading
      if (headingMatch) {
        const headingTag = headingMatch[1];
        const headingText = headingMatch[2];
  
        // Set the current heading level based on tag (h1, h2, h3, h4)
        headingLevels[`section_main_heading_${headingTag.charAt(1)}`] = headingText;
  
        // Clear deeper heading levels when a higher level is encountered
        for (let i = parseInt(headingTag.charAt(1)) + 1; i <= 4; i++) {
          delete headingLevels[`section_main_heading_${i}`];
        }
      }
      // Check if we're within a table, and capture the entire table structure
      else if (part.value.includes('<table')) {
        insideTable = true;
        currentOriginalTable = ''; // Reset for a new table capture
        currentModifiedTable = '';
      }
  
      if (insideTable) {
        // Capture all table content for both original and modified content
        if (part.added) {
          currentModifiedTable += part.value;
        } else if (part.removed) {
          currentOriginalTable += part.value;
        } else {
          // If unchanged, add to both original and modified content to capture the full table
          currentOriginalTable += part.value;
          currentModifiedTable += part.value;
        }
  
        // If the table closes, finalize and push the table structure with any modifications
        if (part.value.includes('</table>')) {
          insideTable = false;
  
          structuredDiff.push({
            ...headingLevels,
            type: currentOriginalTable && currentModifiedTable ? 'modified' : currentOriginalTable ? 'removed' : 'added',
            original_content: currentOriginalTable.trim(),
            modified_content: currentModifiedTable.trim()
          });
  
          // Reset table capture variables
          currentOriginalTable = '';
          currentModifiedTable = '';
        }
      }
      // Capture image additions/removals outside of tables
      else if ((part.added || part.removed) && /<img/i.test(part.value)) {
        structuredDiff.push({
          ...headingLevels,
          type: part.added ? 'added' : 'removed',
          original_content: part.removed ? part.value.trim() : '',
          modified_content: part.added ? part.value.trim() : ''
        });
      }
      // Handle general content modifications outside tables and images
      else if (part.added || part.removed) {
        structuredDiff.push({
          ...headingLevels,
          type: part.added ? 'added' : 'removed',
          original_content: part.removed ? part.value.trim() : '',
          modified_content: part.added ? part.value.trim() : ''
        });
      }
    });
  
    return structuredDiff;
  }