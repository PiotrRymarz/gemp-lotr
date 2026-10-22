// Minimal XML reading for the dev scripts (the server's responses are small and well-formed).
// Nodes are {tag, attrs, children}.

function decodeEntities(text) {
    return text.replace(/&(#x?[0-9a-fA-F]+|lt|gt|amp|quot|apos);/g, function (m, e) {
        if (e == "lt") return "<";
        if (e == "gt") return ">";
        if (e == "amp") return "&";
        if (e == "quot") return "\"";
        if (e == "apos") return "'";
        if (e[1] == "x") return String.fromCodePoint(parseInt(e.substring(2), 16));
        return String.fromCodePoint(parseInt(e.substring(1)));
    });
}

function parseXml(xml) {
    const root = {tag: "#root", attrs: {}, children: []};
    const stack = [root];
    const tagRe = /<(\/?)([A-Za-z_][\w.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
    const attrRe = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = tagRe.exec(xml)) != null) {
        if (m[1]) {
            stack.pop();
            continue;
        }
        const node = {tag: m[2], attrs: {}, children: []};
        let a;
        while ((a = attrRe.exec(m[3])) != null)
            node.attrs[a[1]] = decodeEntities(a[2] != null ? a[2] : a[3]);
        stack[stack.length - 1].children.push(node);
        if (!m[4])
            stack.push(node);
    }
    return root.children[0];
}

function findAll(node, tag, out = []) {
    for (const child of node.children) {
        if (child.tag == tag)
            out.push(child);
        findAll(child, tag, out);
    }
    return out;
}

// The plain event object MobileGameState.apply expects, from a parsed <ge> node
function toEvent(node) {
    return {
        type: node.attrs.type,
        attr: node.attrs,
        children: node.children.map(c => ({tag: c.tag, attr: c.attrs}))
    };
}

module.exports = {parseXml, findAll, toEvent};
