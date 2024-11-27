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

    const normalizeQuotes = (str: string) => str.replace(/\\"/g, '"').replace(/\\\\"/g, '\\"');

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

    const extractSections = (root: HTMLElement) => {
        const sections: { [key: string]: string } = {};
        const currentHeadings:any = {
            section_main_heading1: '',
            section_main_heading2: '',
            section_main_heading3: '',
            section_main_heading4: '',
        };

        root.childNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
                if (node.tagName.match(/^h[1-4]$/i)) {
                    const level = parseInt(node.tagName.charAt(1));
                    currentHeadings[`section_main_heading${level}`] = node.outerHTML.trim();

                    // Clear deeper headings
                    for (let i = level + 1; i <= 4; i++) {
                        currentHeadings[`section_main_heading${i}`] = '';
                    }
                } else {
                    // Aggregate content under the current heading context
                    const headingKey = Object.values(currentHeadings)
                        .filter((heading) => heading) // Include only populated headings
                        .join(' > ');
                    if (!sections[headingKey]) sections[headingKey] = '';
                    sections[headingKey] += node.outerHTML.trim();
                }
            }
        });

        return sections;
    };

    const compareSections = (sections1: { [key: string]: string }, sections2: { [key: string]: string }) => {
        const allHeadings = new Set([...Object.keys(sections1), ...Object.keys(sections2)]);

        allHeadings.forEach((heading) => {
            const content1 = normalizeQuotes(sections1[heading] || '');
            const content2 = normalizeQuotes(sections2[heading] || '');

            if (shouldIgnore(content1) && shouldIgnore(content2)) return;

            const headingParts = heading.split(' > ').filter(Boolean); // Split and clean heading hierarchy
            console.log(headingParts)
            const headingMap:any = {
                section_main_heading1: headingParts[0] || '',
                section_main_heading2: headingParts[1] || '',
                section_main_heading3: headingParts[2] || '',
                section_main_heading4: headingParts[3] || '',
            };

            if (!content1 && content2) {
                structuredDiff.push({
                    ...headingMap,
                    type: 'added',
                    original_content: '',
                    modified_content: content2,
                });
            } else if (content1 && !content2) {
                structuredDiff.push({
                    ...headingMap,
                    type: 'deleted',
                    original_content: content1,
                    modified_content: '',
                });
            } else if (content1 !== content2) {
                structuredDiff.push({
                    ...headingMap,
                    type: 'modified',
                    original_content: content1,
                    modified_content: content2,
                });
            }
        });
    };

    const tree1 = parseHTML(html1);
    const tree2 = parseHTML(html2);

    if (!tree1 || !tree2) {
        console.error('Failed to parse one or both HTML inputs.');
        return [];
    }

    const sections1 = extractSections(tree1 as HTMLElement);
    const sections2 = extractSections(tree2 as HTMLElement);

    compareSections(sections1, sections2);

    return structuredDiff;
}