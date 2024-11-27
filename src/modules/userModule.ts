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

  const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim();

  const parseHTML = (html: string) => parse(html, { lowerCaseTagName: true });

  const diffElements = (el1: HTMLElement | null, el2: HTMLElement | null, currentHeadings: any) => {
      if (!el1 && el2) {
          structuredDiff.push({
              ...currentHeadings,
              type: 'added',
              original_content: '',
              modified_content: el2.outerHTML.trim(),
          });
      } else if (el1 && !el2) {
          structuredDiff.push({
              ...currentHeadings,
              type: 'deleted',
              original_content: el1.outerHTML.trim(),
              modified_content: '',
          });
      } else if (el1 && el2 && el1.tagName === el2.tagName) {
          if (el1.innerHTML.trim() !== el2.innerHTML.trim()) {
              if (el1.tagName.match(/^h[1-4]$/i)) {
                  const level = parseInt(el1.tagName.charAt(1));
                  currentHeadings[`section_main_heading_${level}`] = el2.text.trim();

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

          const children1 = el1.childNodes.filter((node) => node instanceof HTMLElement);
          const children2 = el2.childNodes.filter((node) => node instanceof HTMLElement);

          const maxLength = Math.max(children1.length, children2.length);
          for (let i = 0; i < maxLength; i++) {
              diffElements(children1[i] as HTMLElement, children2[i] as HTMLElement, currentHeadings);
          }
      } else {
          structuredDiff.push({
              ...currentHeadings,
              type: 'modified',
              original_content: el1 ? el1.outerHTML.trim() : '',
              modified_content: el2 ? el2.outerHTML.trim() : '',
          });
      }
  };

  const tree1 = parseHTML(html1);
  const tree2 = parseHTML(html2);

  diffElements(tree1, tree2, headingLevels);

  return structuredDiff;
}