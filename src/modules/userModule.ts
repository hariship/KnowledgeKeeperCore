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

  const ignorePatterns = [
      `<p data-f-id=\\"pbf\\" style=\\"text-align: center; font-size: 14px; margin-top: 30px; opacity: 0.65; font-family: sans-serif;\\">Powered by <a href=\\"https://www.froala.com/wysiwyg-editor?pb=1\\" title=\\"Froala Editor\\">Froala Editor</a></p>`
  ];

  const shouldIgnore = (content: string) => {
      return ignorePatterns.some((pattern) => content.includes(pattern));
  };

  const parseHTML = (html: string) => {
      try {
          return parse(html, { lowerCaseTagName: true });
      } catch (error) {
          console.error('Error parsing HTML:', error);
          return null;
      }
  };

  const diffElements = (
      el1: HTMLElement | null,
      el2: HTMLElement | null,
      currentHeadings: { [key: string]: string }
  ) => {
      const defaultHeadings = {
          section_main_heading_1: currentHeadings.section_main_heading_1 || '',
          section_main_heading_2: currentHeadings.section_main_heading_2 || '',
          section_main_heading_3: currentHeadings.section_main_heading_3 || '',
          section_main_heading_4: currentHeadings.section_main_heading_4 || '',
      };

      if (!el1 && el2) {
          if (shouldIgnore(el2.outerHTML)) return;
          structuredDiff.push({
              ...defaultHeadings,
              type: 'added',
              original_content: '',
              modified_content: el2.outerHTML.trim(),
          });
          return;
      }

      if (el1 && !el2) {
          if (shouldIgnore(el1.outerHTML)) return;
          structuredDiff.push({
              ...defaultHeadings,
              type: 'deleted',
              original_content: el1.outerHTML.trim(),
              modified_content: '',
          });
          return;
      }

      if (el1 && el2) {
          if (shouldIgnore(el1.outerHTML) || shouldIgnore(el2.outerHTML)) return;

          if (el1.tagName && el1.tagName.match(/^h[1-4]$/i)) {
              const level = parseInt(el1.tagName.charAt(1));
              currentHeadings[`section_main_heading_${level}`] = el2.text.trim();
              for (let i = level + 1; i <= 4; i++) {
                  currentHeadings[`section_main_heading_${i}`] = '';
              }
          }

          if (el1.innerHTML.trim() !== el2.innerHTML.trim()) {
              structuredDiff.push({
                  ...defaultHeadings,
                  type: 'modified',
                  original_content: el1.outerHTML.trim(),
                  modified_content: el2.outerHTML.trim(),
              });
          }

          const children1 = el1.childNodes.filter((node) => node instanceof HTMLElement) as HTMLElement[];
          const children2 = el2.childNodes.filter((node) => node instanceof HTMLElement) as HTMLElement[];

          const maxLength = Math.max(children1.length, children2.length);
          for (let i = 0; i < maxLength; i++) {
              diffElements(children1[i] || null, children2[i] || null, currentHeadings);
          }
      } else {
          console.warn('Unexpected state: el1 or el2 is invalid:', { el1, el2 });
      }
  };

  const tree1 = parseHTML(html1);
  const tree2 = parseHTML(html2);

  if (!tree1 || !tree2) {
      console.error('Failed to parse one or both HTML inputs.');
      return [];
  }

  diffElements(tree1 as HTMLElement, tree2 as HTMLElement, headingLevels);
  structuredDiff.shift()
  return structuredDiff;
}