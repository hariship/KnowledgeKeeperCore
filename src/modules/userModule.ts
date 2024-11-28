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

    const extractTextContent = (node: HTMLElement) => {
        // Allowed tags
        const allowedTags = ['b', 'i', 'strikethrough'];
    
        const traverseAndClean = (child: any): string => {
            if (child instanceof HTMLElement) {
                // If the tag is allowed, rebuild the tag with its content
                if (allowedTags.includes(child.tagName.toLowerCase())) {
                    const innerHTML = child.childNodes
                        .map((grandChild) =>
                            grandChild instanceof HTMLElement
                                ? traverseAndClean(grandChild)
                                : grandChild.rawText
                        )
                        .join('');
                    return `<${child.tagName.toLowerCase()}>${innerHTML}</${child.tagName.toLowerCase()}>`;
                } else {
                    // Replace the child node with its text content if tag is not allowed
                    return child.textContent || '';
                }
            }
            // For non-HTMLElement nodes, return raw text
            return child.rawText || '';
        };
    
        // Process the node and return its cleaned HTML
        return traverseAndClean(node).trim();
    };

    const extractSections = (root: HTMLElement) => {
        const sections: { [key: string]: string } = {};
        const currentHeadings: { [key: string]: string } = {
            section_main_heading1: '',
            section_main_heading2: '',
            section_main_heading3: '',
            section_main_heading4: '',
        };

        root.childNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
                if (node.tagName.match(/^h[1-4]$/i)) {
                    const level = parseInt(node.tagName.charAt(1));
                    const headingKey = `section_main_heading${level}`;
                    currentHeadings[headingKey] = extractTextContent(node);

                    // Clear deeper headings
                    for (let i = level + 1; i <= 4; i++) {
                        currentHeadings[`section_main_heading${i}`] = '';
                    }
                } else {
                    // Dynamically map headings based on presence
                    const activeHeadings = Object.entries(currentHeadings)
                        .filter(([_, value]) => value) // Include only populated headings
                        .reduce((acc, [key, value]) => {
                            acc[key] = value;
                            return acc;
                        }, {} as { [key: string]: string });

                    const headingKey = JSON.stringify(activeHeadings);
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

            const activeHeadings = JSON.parse(heading);

            if (!content1 && content2) {
                structuredDiff.push({
                    ...activeHeadings,
                    type: 'added',
                    original_content: '',
                    modified_content: content2,
                });
            } else if (content1 && !content2) {
                structuredDiff.push({
                    ...activeHeadings,
                    type: 'deleted',
                    original_content: content1,
                    modified_content: '',
                });
            } else if (content1 !== content2) {
                structuredDiff.push({
                    ...activeHeadings,
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