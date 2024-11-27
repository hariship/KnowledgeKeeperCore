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

  const normalizeQuotes = (str: string) => str.replace(/\\\\"/g, '\\"').replace(/\\"/g, '"');

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
        section_main_heading1: currentHeadings.section_main_heading1 || '',
        section_main_heading2: currentHeadings.section_main_heading2 || '',
        section_main_heading3: currentHeadings.section_main_heading3 || '',
        section_main_heading4: currentHeadings.section_main_heading4 || '',
    };

    if (!el1 && el2) {
        const content = normalizeQuotes(el2.outerHTML.trim());
        if (shouldIgnore(content)) return;
        structuredDiff.push({
            ...defaultHeadings,
            type: 'added',
            original_content: '',
            modified_content: content,
        });
        return;
    }

    if (el1 && !el2) {
        const content = normalizeQuotes(el1.outerHTML.trim());
        if (shouldIgnore(content)) return;
        structuredDiff.push({
            ...defaultHeadings,
            type: 'deleted',
            original_content: content,
            modified_content: '',
        });
        return;
    }

    if (el1 && el2) {
        const content1 = normalizeQuotes(el1.outerHTML.trim());
        const content2 = normalizeQuotes(el2.outerHTML.trim());

        if (shouldIgnore(content1) || shouldIgnore(content2)) return;

        // Handle <table> as a whole and avoid splitting <tr> independently
        if (el1.tagName === 'table' && el2.tagName === 'table') {
            if (el1.outerHTML.trim() !== el2.outerHTML.trim()) {
                structuredDiff.push({
                    ...defaultHeadings,
                    type: 'modified',
                    original_content: content1,
                    modified_content: content2,
                });
            }
            return; // Skip further processing of <table> since it's already handled
        }

        if (el1.innerHTML.trim() !== el2.innerHTML.trim()) {
            structuredDiff.push({
                ...defaultHeadings,
                type: 'modified',
                original_content: content1,
                modified_content: content2,
            });

            const children1 = el1.childNodes.filter((node) => node instanceof HTMLElement) as HTMLElement[];
            const children2 = el2.childNodes.filter((node) => node instanceof HTMLElement) as HTMLElement[];

            const maxLength = Math.max(children1.length, children2.length);
            for (let i = 0; i < maxLength; i++) {
                diffElements(children1[i] || null, children2[i] || null, currentHeadings);
            }
        }
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