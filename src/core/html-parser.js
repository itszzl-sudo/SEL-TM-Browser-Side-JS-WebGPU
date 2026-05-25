/**
 * HTML 文档解析器
 * 负责解析完整的 HTML 文档结构
 */
export class HTMLDocumentParser {
  constructor() {
    this.document = {
      doctype: '',
      html: {
        head: { styles: [], scripts: [], title: '' },
        body: { children: [] }
      }
    };
    this.currentTag = '';
    this.currentAttrs = {};
  }

  /**
   * 解析完整 HTML 文档
   * @param {string} htmlText - HTML 文本
   * @returns {object} 解析后的文档对象
   */
  parse(htmlText) {
    // 解析 DOCTYPE
    const doctypeMatch = htmlText.match(/<!DOCTYPE\s+([^>]+)>/i);
    if (doctypeMatch) {
      this.document.doctype = doctypeMatch[1].trim();
    }

    // 解析 HTML 内容
    const htmlMatch = htmlText.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
    if (htmlMatch) {
      this.parseHTMLContent(htmlMatch[1]);
    }

    return this.document;
  }

  /**
   * 解析 HTML 内容（head + body）
   * @param {string} content - HTML 内容
   */
  parseHTMLContent(content) {
    // 解析 head
    const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headMatch) {
      this.parseHead(headMatch[1]);
    }

    // 解析 body
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      this.parseBody(bodyMatch[1]);
    }
  }

  /**
   * 解析 head 内容
   * @param {string} headContent - head 内容
   */
  parseHead(headContent) {
    // 解析 title
    const titleMatch = headContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      this.document.html.head.title = titleMatch[1].trim();
    }

    // 解析 style 标签
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    while ((styleMatch = styleRegex.exec(headContent)) !== null) {
      this.document.html.head.styles.push(styleMatch[1]);
    }

    // 解析 script 标签
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    while ((scriptMatch = scriptRegex.exec(headContent)) !== null) {
      this.document.html.head.scripts.push(scriptMatch[1]);
    }
  }

  /**
   * 解析 body 内容
   * @param {string} bodyContent - body 内容
   */
  parseBody(bodyContent) {
    this.document.html.body.children = this.parseElements(bodyContent);
  }

  /**
   * 解析元素列表
   * @param {string} content - 元素内容
   * @returns {array} 元素数组
   */
  parseElements(content) {
    const elements = [];
    const tagRegex = /<([a-zA-Z][a-zA-Z0-9]*)\s*([^>]*)>([^<]*)/gi;
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      const tagName = match[1].toLowerCase();
      const attrsStr = match[2];
      const innerText = match[3].trim();

      const element = {
        tag: tagName,
        attrs: this.parseAttributes(attrsStr),
        children: [],
        text: innerText
      };

      elements.push(element);
    }

    return elements;
  }

  /**
   * 解析标签属性
   * @param {string} attrsStr - 属性字符串
   * @returns {object} 属性对象
   */
  parseAttributes(attrsStr) {
    const attrs = {};
    if (!attrsStr) return attrs;

    const attrRegex = /([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*["']([^"']+)["']/g;
    let match;

    while ((match = attrRegex.exec(attrsStr)) !== null) {
      attrs[match[1]] = match[2];
    }

    return attrs;
  }

  /**
   * 获取 CSS 规则
   * @returns {Map} CSS 规则映射
   */
  getCssRules() {
    const rules = new Map();

    this.document.html.head.styles.forEach(styleText => {
      const ruleRegex = /([^{]+)\s*\{([^}]+)\}/g;
      let match;

      while ((match = ruleRegex.exec(styleText)) !== null) {
        const selector = match[1].trim();
        const styleStr = match[2].trim();

        const style = {};
        const stylePairs = styleStr.split(';').filter(p => p.trim());

        stylePairs.forEach(pair => {
          const [key, val] = pair.split(':').map(s => s.trim());
          if (key && val) {
            style[key] = val;
          }
        });

        rules.set(selector, style);
      }
    });

    return rules;
  }
}