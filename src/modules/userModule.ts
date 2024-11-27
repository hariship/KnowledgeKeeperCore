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
    const sections: { [key: string]: { type: string; original: string[]; modified: string[] } } = {};

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
        currentHeadings: { [key: string]: string },
        parentProcessed: boolean = false // Tracks if parent was already processed
    ) => {
        const defaultHeadings = {
            section_main_heading1: currentHeadings.section_main_heading1 || '',
            section_main_heading2: currentHeadings.section_main_heading2 || '',
            section_main_heading3: currentHeadings.section_main_heading3 || '',
            section_main_heading4: currentHeadings.section_main_heading4 || '',
        };

        const normalizeQuotes = (str: string) => str.replace(/\\\\"/g, '\\"').replace(/\\"/g, '"');
          
        const ignorePatterns = [
            `<p data-f-id=\\"pbf\\" style=\\"text-align: center; font-size: 14px; margin-top: 30px; opacity: 0.65; font-family: sans-serif;\\">Powered by <a href=\\"https://www.froala.com/wysiwyg-editor?pb=1\\" title=\\"Froala Editor\\">Froala Editor</a></p>`
        ];
        
        const shouldIgnore = (content: string) => {
            return ignorePatterns.some((pattern) => content.includes(pattern));
        }

    
        // Handle added content
        if (!el1 && el2) {
            const content = normalizeQuotes(el2.outerHTML.trim());
            if (!shouldIgnore(content)) {
                structuredDiff.push({
                    ...defaultHeadings,
                    type: 'added',
                    original_content: '',
                    modified_content: content,
                });
            }
            return;
        }
    
        // Handle deleted content
        if (el1 && !el2) {
            const content = normalizeQuotes(el1.outerHTML.trim());
            if (!shouldIgnore(content)) {
                structuredDiff.push({
                    ...defaultHeadings,
                    type: 'deleted',
                    original_content: content,
                    modified_content: '',
                });
            }
            return;
        }
    
        // Handle modified content
        if (el1 && el2) {
            const content1 = normalizeQuotes(el1.outerHTML.trim());
            const content2 = normalizeQuotes(el2.outerHTML.trim());
    
            if (shouldIgnore(content1) || shouldIgnore(content2)) return;
    
            // Update current headings if the element is a heading
            if (el1.tagName && el1.tagName.match(/^h[1-4]$/i)) {
                const level = parseInt(el1.tagName.charAt(1));
                currentHeadings[`section_main_heading${level}`] = el1.text.trim();
    
                // Clear deeper headings (e.g., reset heading3 and heading4 when heading2 is updated)
                for (let i = level + 1; i <= 4; i++) {
                    currentHeadings[`section_main_heading${i}`] = '';
                }
            }
    
            // Handle <table> as a whole
            if (el1.tagName === 'table' && el2.tagName === 'table') {
                if (content1 !== content2) {
                    structuredDiff.push({
                        ...defaultHeadings,
                        type: 'modified',
                        original_content: content1,
                        modified_content: content2,
                    });
                }
                return; // Skip processing children of <table>
            }
    
            // Skip child elements if parent is already processed
            if (parentProcessed) return;
    
            // If the element itself differs, add it to the diff
            if (el1.innerHTML.trim() !== el2.innerHTML.trim()) {
                structuredDiff.push({
                    ...defaultHeadings,
                    type: 'modified',
                    original_content: content1,
                    modified_content: content2,
                });
            }
    
            // Process child elements
            const children1 = el1.childNodes.filter((node) => node instanceof HTMLElement) as HTMLElement[];
            const children2 = el2.childNodes.filter((node) => node instanceof HTMLElement) as HTMLElement[];
    
            const maxLength = Math.max(children1.length, children2.length);
            for (let i = 0; i < maxLength; i++) {
                diffElements(children1[i] || null, children2[i] || null, currentHeadings);
            }
        }
    };

    const tree1 = parseHTML(html1);
    const tree2 = parseHTML(html2);

    if (!tree1 || !tree2) {
        console.error('Failed to parse one or both HTML inputs.');
        return [];
    }

    const currentHeadings = {
        section_main_heading1: '',
        section_main_heading2: '',
        section_main_heading3: '',
        section_main_heading4: '',
    };

    diffElements(tree1 as HTMLElement, tree2 as HTMLElement, currentHeadings);

    // Generate structured diffs by headings
    for (const heading in sections) {
        structuredDiff.push({
            ...Object.fromEntries(
                Object.entries(currentHeadings).filter(([_, value]) => heading.includes(value))
            ),
            type: sections[heading].type,
            original_content: sections[heading].original.join('\n'),
            modified_content: sections[heading].modified.join('\n'),
        });
    }

    return structuredDiff;
}