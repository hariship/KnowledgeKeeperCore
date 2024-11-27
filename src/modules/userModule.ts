import jwt from 'jsonwebtoken';
import { diffWordsWithSpace } from 'diff';
import { parse, HTMLElement } from 'node-html-parser'; // Install via `npm install node-html-parser`


export const generateToken = (user: any) => {
    const JWT_SECRET = process.env.JWT_SECRET || "custom_jwt";
    let signedtoken =  jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '48h' });
    return signedtoken;
};

export async function getStructuredHTMLDiff(html1: string, html2: string) {
  const structuredDiff: any[] = [];
  const headingLevels: { [key: string]: string } = {};
  const prevHeadingLevels: { [key: string]: string } = {};

  // Helper: Normalize text to minimize whitespace and formatting noise
  const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim();

  // Helper: Parse and validate HTML
  const parseHTML = (html: string) => parse(html, { lowerCaseTagName: true });

  // Recursive diff function for HTML elements
  const diffElements = (el1: any | null, el2: any | null, currentHeadings: any) => {
      if (!el1 && el2) {
          // Element added
          structuredDiff.push({
              ...currentHeadings,
              type: 'added',
              original_content: '',
              modified_content: el2.outerHTML.trim(),
          });
      } else if (el1 && !el2) {
          // Element removed
          structuredDiff.push({
              ...currentHeadings,
              type: 'deleted',
              original_content: el1.outerHTML.trim(),
              modified_content: '',
          });
      } else if (el1 && el2 && el1.tagName === el2.tagName) {
          // Check for changes within the same element
          if (el1.innerHTML.trim() !== el2.innerHTML.trim()) {
              if (el1.tagName.match(/^h[1-4]$/i)) {
                  // Update heading levels for context
                  const level = parseInt(el1.tagName.charAt(1));
                  currentHeadings[`section_main_heading_${level}`] = el2.text.trim();

                  // Clear deeper heading levels
                  for (let i = level + 1; i <= 4; i++) {
                      currentHeadings[`section_main_heading_${i}`] = '';
                  }
              }

              structuredDiff.push({
                  ...currentHeadings,
                  type: 'modified',
                  original_content: el1.outerHTML.trim(),
                  modified_content: el2.outerHTML.trim(),
              });
          }

          // Recursively compare child elements
          const children1 = el1.childNodes.filter((node: any) => node instanceof HTMLElement);
          const children2 = el2.childNodes.filter((node: any) => node instanceof HTMLElement);

          const maxLength = Math.max(children1.length, children2.length);
          for (let i = 0; i < maxLength; i++) {
              diffElements(children1[i] as HTMLElement, children2[i] as HTMLElement, currentHeadings);
          }
      } else {
          // Elements differ
          structuredDiff.push({
              ...currentHeadings,
              type: 'modified',
              original_content: el1.outerHTML.trim(),
              modified_content: el2.outerHTML.trim(),
          });
      }
  };

  // Parse HTML into trees
  const tree1 = parseHTML(html1);
  const tree2 = parseHTML(html2);

  // Diff the trees
  diffElements(tree1, tree2, headingLevels);

  return structuredDiff;
}