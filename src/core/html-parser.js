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
    } else {
      // 如果没有完整的 html 标签，尝试直接解析 body 内容
      const bodyMatch = htmlText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        this.parseBody(bodyMatch[1]);
      } else {
        // 如果连 body 标签都没有，直接解析内容作为 body 的子元素
        this.document.html.body.children = this.parseElements(htmlText);
      }
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
    let pos = 0;

    const svgTags = ['svg', 'rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'text', 'tspan', 'g', 'defs', 'use', 'image', 'symbol', 'marker', 'clippath', 'lineargradient', 'radialgradient', 'stop', 'filter', 'feoffset', 'fegaussianblur', 'feblend', 'fecolormatrix', 'fecomponenttransfer', 'fefunca', 'fefuncb', 'fefuncg', 'fefuncr', 'femerge', 'femergenode', 'feimage', 'fetile', 'flood', 'background'];

    while (pos < content.length) {
      // 跳过空白字符和注释
      const commentMatch = content.substr(pos).match(/^<!--[\s\S]*?-->/);
      if (commentMatch) {
        pos += commentMatch[0].length;
        continue;
      }

      // 跳过空白
      while (pos < content.length && /\s/.test(content[pos])) {
        pos++;
      }

      if (pos >= content.length) break;

      // 查找开始标签
      const startTagMatch = content.substr(pos).match(/^<([a-zA-Z][a-zA-Z0-9]*)\s*([^>]*)>/);
      if (!startTagMatch) {
        // 文本内容
        const textMatch = content.substr(pos).match(/^([^<]+)/);
        if (textMatch) {
          const text = textMatch[1].trim();
          if (text) {
            elements.push({ tag: '#text', text: text, children: [] });
          }
          pos += textMatch[0].length;
        } else {
          pos++;
        }
        continue;
      }

      const tagName = startTagMatch[1].toLowerCase();
      const attrsStr = startTagMatch[2];
      pos += startTagMatch[0].length;

      const element = {
        tag: tagName,
        attrs: this.parseAttributes(attrsStr),
        children: [],
        text: ''
      };

      // 检查是否是 SVG 标签
      if (tagName === 'svg') {
        const svgEndMatch = content.substr(pos).match(/<\/svg>/i);
        if (svgEndMatch) {
          const svgContent = content.substr(0, pos);
          element.children = this.parseElements(svgContent);
          pos += svgEndMatch[0].length;
        }
      }

      // 检查是否是自闭合标签
      if (attrsStr.endsWith('/') || ['img', 'br', 'hr', 'input', 'meta', 'link', 'rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'stop'].includes(tagName)) {
        elements.push(element);
        continue;
      }

      // 查找结束标签
      const endTagPattern = new RegExp(`</${tagName}>`, 'i');
      const endTagMatch = content.substr(pos).match(endTagPattern);
      
      if (!endTagMatch) {
        // 没有结束标签，假设是自闭合
        elements.push(element);
        continue;
      }

      const innerContent = content.substr(pos, endTagMatch.index);
      pos += endTagMatch.index + endTagMatch[0].length;

      // 解析子元素
      const childElements = this.parseElements(innerContent);
      
      // 分离文本和子元素
      let textContent = '';
      childElements.forEach(child => {
        if (child.tag === '#text') {
          textContent += child.text;
        } else {
          element.children.push(child);
        }
      });
      
      element.text = textContent;
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