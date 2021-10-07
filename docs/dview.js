// Copyright (c) 2021 Julijan Andjelic
// DView v0.3.3
class DView {

    constructor(data, actions, styles) {

        this.benchmarkEnabled = true;
        this.debug = false;

        this.conf = {
            keepNodeNames : true,

            // when DViewData.setVal(key, val) val is an array, add some methods to array
            // add - equivalent to push
            // addStart - equivalent to unshift
            // alter, equivalent to splice
            // removeEnd, equivalent to pop
            // removeStart, equivalent to shift
            // useful because otherwise user would have to handle the reactivity of arrays
            extendArray : true
        }

        if (this.benchmarkEnabled) {
            this.startTime = new Date().getTime();
        }
        
        this.styledNodes = [];
        this.styles = this.processStyles(styles) || [];

        this.data = this.initData(data || {});
        this.actions = actions || {};

        //this.data = data;
        this.ignoreTags = [
            'i', 'b', 'a', 'p', 'div', 'span', 'button', 'u', 'pre', 'small',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'canvas', 'img', 'audio', 'video',
            'input', 'select', 'button', 'label'
        ];

        // user defined components (d-component)
        this.components = {};
        this.initComponents();

        this.DOMOriginal = document.body.innerHTML;
        this.rendered = false;

        this.render();

        this.rendered = true;

        if (this.benchmarkEnabled) {
            let time = this.benchmarkTime();
            this.renderTime = time;
            if (this.debug) {
                console.log(`Page rendered in ${this.renderTime}ms`);
            }
        }
    }

    parse(root, path) {
        if (typeof root === 'undefined') {
            root = new DViewNode(this, document.body);
        }

        if (! (path instanceof Array)) {
            path = [];
        }

        path = Array.from(path);

        path.push(root.name);

        root.children = [];

        let children = root.node.childNodes;

        for (let i = 0; i < children.length; i++) {
            let child = children[i];
            if (child.nodeType == 1) {
                // Tag
                let component = this.components[child.tagName.toLowerCase()];
                let isComponent = component != undefined;
                if (root.isList()) {
                    let data = root.data();
                    let node = root.listNode();
                    // list
                    for (let i = 0; i < data.length; i++) {
                        let pathNew = Array.from(path);
                        if (! isComponent) {
                            root.children.push(this.parse(new DViewNode(this, this.parent ? this.parent.listItem.cloneNode(true) : node.cloneNode(true), pathNew, root, i), Array.from(path)));
                        } else {
                            // component
                            let cmp = component.clone();
                            cmp.parent = root;
                            cmp.listIndex = i;
                            cmp.pathSet(pathNew);
                            root.children.push(cmp);
                        }
                    }
                } else {
                    if (! isComponent) {
                        root.children.push(this.parse(new DViewNode(this, child, Array.from(path), root), Array.from(path)));
                    } else {
                        // component
                        let cmp = component.clone();
                        cmp.parent = root;
                        cmp.pathSet(Array.from(path));
                        root.children.push(cmp);
                    }
                }
            } else {
                // other node types, preserve as they are
                root.children.push(child);
            }
        }

        return root;
    }

    dom(root) {
        if (typeof root === 'undefined') {
            root = this.objectModel;
        }
        return document.createElement('div').appendChild(root.dom());
    }

    render() {
        this.reset();
        document.body.innerHTML = '';
        document.body.appendChild(this.dom());
        // init nodes recursively
        this.objectModel.initNode();
    }

    reset() {
        document.body.innerHTML = this.DOMOriginal;
        this.objectModel = this.parse();
    }

    initComponents() {
        let components = document.querySelectorAll('d-component');
        for (let i = 0; i < components.length; i++) {
            let component = components[i];
            let attributes = component.getAttributeNames();
            if (attributes.indexOf('name') == -1) {
                console.warn('Skipped component with no name');
                continue;
            }
            let name = component.getAttribute('name');

            if (this.components[name] instanceof DViewNode) {
                console.warn(`Component ${name} already defined, skipping`);
                continue;
            }

            component.setAttribute('d-name', name);

            this.components['d-' + name] = this.parse(new DViewNode(this, component.cloneNode(true)), []);

            // remove from DOM tree
            component.parentNode.removeChild(component);
        }
    }

    initData(data) {
        if (data instanceof Array) {
            for (let i = 0; i < data.length; i++) {
                if (typeof data[i] === 'object') {
                    data[i] = this.initData(data[i]);
                }
            }
            return data;
        }
        let dataStore = new DViewData(this);
        let keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (data[key] instanceof Array) {
                
                for (let j = 0; j < data[key].length; j++) {
                    let dataInArr = data[key][j];
                    if (dataInArr instanceof Array) {
                        data[key][j] = this.initData(dataInArr);
                    }
                }
                dataStore.setVal(key, data[key], true);
            } else if (typeof data[key] === 'object') {
                dataStore.setVal(key, this.initData(data[key]), true);
            } else {
                dataStore.setVal(key, data[key], true);
            }
        }
        return dataStore;
    }

    query(path) {
        return this.objectModel.query(path);
    }

    queryAll(path) {
        return this.objectModel.queryAll(path);
    }

    pathClean(path) {
        return path.filter((seg) => {
            return this.ignoreTags.indexOf(seg) == -1;
        });
    }

    withinPath(haystack, needle, matchLength, matchStart, matchEnd) {

        if (typeof matchLength !== 'boolean') {
            matchLength = false;
        }

        if (typeof matchEnd !== 'boolean') {
            matchEnd = false;
        }

        if (typeof matchStart !== 'boolean') {
            matchStart = false;
        }

        // different length
        if (matchLength && haystack.length != needle.length) {
            return false;
        }

        let offsetMax = haystack.length - needle.length;

        // needle longer than haystack
        if (offsetMax < 0) {
            return false;
        }

        for (let i = 0; i < offsetMax + 1; i++) {
            // i iterator for haystack offset
            // n haystack
            let allMatch = true;
            for (let j = 0; j < needle.length; j++) {
                if (needle[j] != haystack[i + j]) {
                    allMatch = false;
                    break;
                }
            }
            if (allMatch && (! matchEnd || i == offsetMax)) {
                return true;
            }
            // no match on offset 0
            if (matchStart) {
                return false;
            }
        }
        
        return false;
    }

    // matches if all items from needle are in haystack in the same order
    withinPathLoose(haystack, needle) {
        
        let lastMatchIndex = 0;
        for (let i = 0; i < needle.length; i++) {
            let found = false;
            for (let j = lastMatchIndex; j < haystack.length; j++) {
                if (needle[i] == haystack[j]) {
                    lastMatchIndex = j;
                    found = true;
                    break;
                }
            }

            if (! found) {
                return false;
            }
        }

        return true;
    }

    processStyles(styles) {
        if (typeof styles !== 'object') {
            return [];
        }

        let stylesProcessed = [];

        let paths = Object.keys(styles);

        paths.forEach((pathText) => {
            let style = {
                path : pathText.split('.'),
                styles : styles[pathText]
            }
            stylesProcessed.push(style);
        });

        return stylesProcessed;
    }

    // any data changed
    dataChanged() {
        this.stylesUpdate();
    }
    
    stylesUpdate() {
        this.styledNodes.forEach((node) => {
            node.styleUpdate();
        });
    }

    benchmarkTime() {
        return new Date().getTime() - this.startTime;
    }

    exec(actionName, args) {
        if (! (args instanceof Array)) {
            args = [];
        }
        if (typeof this.actions[actionName] === 'function') {
            this.actions[actionName].apply(this, args);
        } else {
            console.warn(`Action ${actionName} not defined`);
        }
    }
}

class DViewData {

    constructor(dview) {
        this.dview = dview;
        this.data = {};
        this.nodes = []; // listening nodes
    }

    setVal(key, val, silent) {
        if (typeof silent !== 'boolean') {
            silent = false;
        }

        //if (this.dview.rendered) {

            if (val instanceof Array) {
                for (let i = 0; i < val.length; i++) {
                    if (typeof val[i] === 'object' && !(val[i] instanceof Array)) {
                        let data = new DViewData(this.dview);
                        let keys = Object.keys(val[i]);
                        keys.forEach((key) => {
                            data.setVal(key, val[i][key], true);
                        });
                        val[i] = data;
                    }
                }

                if (this.dview.conf.extendArray) {
                    // push
                    val.add = (item) => {
                        // if adding an object, make it reactive
                        if (typeof item === 'object' && ! (item instanceof DViewData)) {
                            item = this.dview.initData(item);
                        }
                        let ret = val.push(item);
                        this.changed(key);
                        return ret;
                    }

                    // unshift
                    val.addStart = (item) => {
                        // if adding an object, make it reactive
                        if (typeof item === 'object' && ! (item instanceof DViewData)) {
                            item = this.dview.initData(item);
                        }
                        let ret = val.unshift(item);
                        this.changed(key);
                        return ret;
                    }

                    // pop
                    val.removeEnd = () => {
                        let ret = val.pop();
                        this.changed(key);
                        return ret;
                    }

                    // shift
                    val.removeStart = () => {
                        let ret = val.shift();
                        this.changed(key);
                        return ret;
                    }

                    // remove exact item
                    val.remove = (index) => {
                        let ret = val.splice(index, 1);
                        this.changed(key);
                        return ret;
                    }

                    // splice
                    val.alter = (start, remove, add) => {
                        let ret;
                        if (typeof add !== 'undefined') {
                            // if adding an object, make it reactive
                            if (typeof add === 'object' && ! (add instanceof DViewData)) {
                                add = this.dview.initData(add);
                            }
                            ret = val.splice(start, remove, add);
                        } else {
                            ret = val.splice(start, remove);
                        }
                        this.changed(key);
                        return ret;
                    }
                }
            }
        //}

        let keyLower = key.toLowerCase();

        if (typeof this.data[keyLower] === 'undefined') {
            // defining new property
            Object.defineProperty(this, keyLower, {
                get: function() {
                    if (typeof this.data[keyLower] === 'function' && keyLower != 'data') {
                        return this.data[keyLower].apply(this.dview, []);
                    }
                    return this.data[keyLower];
                },
                set: function(value) {
                    this.data[keyLower] = value;
                    this.changed(keyLower);
                    this.dview.dataChanged();
                    return this;
                }
            });

            if (keyLower !== key) {
                Object.defineProperty(this, key, {
                    get: function() {
                        if (typeof this.data[keyLower] === 'function' && keyLower != 'data') {
                            return this.data[keyLower].apply(this.dview, []);
                        }
                        return this.data[keyLower];
                    },
                    set: function(value) {
                        this.data[keyLower] = value;
                        this.changed(keyLower);
                        this.dview.dataChanged();
                        return this;
                    }
                });
            }

            // subscribe
            let nodes = this.nodesUsingData();
            let nodesInterested = nodes.filter((node) => {
                return node.name == keyLower;
            });
            nodesInterested.forEach((node) => {
                node.subscribe(this, keyLower);
            });
        }

        if (! silent) {
            this[keyLower] = val;
        } else {
            // won't trigger the change event listeners
            this.data[keyLower] = val;
        }
    }

    // add given node to nodes array
    // nodes are notified of changes
    uses(node, value) {
        if (node instanceof DViewNode) {
            this.nodes.push([node, value]);
        }
    }

    changed(key) {
        if (this.dview.debug) {
            console.log('changed ' + key);
        }
        if (this.nodes.length == 0) {return false;}
        if (this.dview.rendered == false) {return false;}

        this.nodes = this.nodes.filter((node) => {
            return node[0].destroyed == false;
        });

        let interestedNodes = this.nodes.filter((node) => {
            return node.indexOf(key) > -1 || node.indexOf('*') > -1;
        });

        interestedNodes.reduce((prev, curr) => {
            if (prev.indexOf(curr[0]) == -1) {
                prev.push(curr[0]);
            }
            return prev;
        }, []).forEach((node) => {
            node.cacheClear();
            node.redraw();
        });
    }

    clone() {
        let clone = new DViewData(this.dview);

        let keys = Object.keys(this.data);
        keys.forEach((key) => {
            if (this.data[key] instanceof DViewData) {
                clone[key] = this.data[key].clone();
            } else {
                clone.setVal(key, this.data[key], true);
            }
        });

        return clone;
        
    }

    // return all nodes that use this data
    nodesUsingData(nodes) {
        if (! this.dview.rendered) {return [];}
        if (! (nodes instanceof Array)) {
            nodes = this.dview.objectModel.children;
        }

        let matches = [];

        let childNodes = [];
        for (let i = 0; i < nodes.length; i++) {
            if (typeof nodes[i].data !== 'function') {
                continue;
            }
            if (nodes[i].data() == this) {
                matches = matches.concat([nodes[i]]);
            }
            childNodes = childNodes.concat(nodes[i].childNodes());
        }

        if (childNodes.length > 0) {
            matches = matches.concat(this.nodesUsingData(childNodes));
        }

        return matches;
    }
}

class DViewNode {
    constructor(dview, node, path, parent, listIndex) {
        this.dview = dview;
        this.parent = parent || null;

        this.listIndex = typeof listIndex === 'number' ? listIndex : null;

        
        
        if (! (path instanceof Array)) {
            path = [];
        } else {
            path = Array.from(path);
        }
        
        this.node = node;
        this.name = node.tagName.toLowerCase();
        if (this.name === 'tag') {console.log(listIndex)}
        this.children = [];
        this.path = path;
        this.listItem = null;
        this.nodeOriginal = node.cloneNode(true);

        this.classNamesOriginal = [];

        // d-if value
        this.showCondition = null;
        this.showConditionData = null;
        this.showConditionKey = null;
        this.showConditionPath = null;

        this.HTMLData = false; // if true, treat node data as HTML


        this.dataSubscribed = [];

        this.destroyed = false;

        this.inDOM = true;
        this.initialized = false;

        this.dataCached = null;

        // d-name (if set, updates the node's name)
        if (this.node.hasAttribute('d-name')) {
            let name = this.node.getAttribute('d-name').toLowerCase();
            this.name = name;
        }

        if (this.isList()) {
            this.listItem = this.listNode().cloneNode(true);
        }

        if (this.parent instanceof DViewNode && this.isDataNode()) {
            this.subscribe(this.parent.data(), this.name);
        }

        // subscribe to style changes
        let styles = this.styles();
        if (styles.length > 0) {
            this.dview.styledNodes.push(this);
        }

    }

    dom() {

        this.clickInitialized = false;
        if (this.destroyed) {
            this.nodeRemove();
            return null;
        }

        let node = document.createElement('div');
        if (this.dview.ignoreTags.indexOf(this.node.tagName.toLowerCase()) > -1) {
            node = document.createElement(this.node.tagName.toLowerCase());
        } else {
            if (this.dview.conf.keepNodeNames && this.name != 'body') {
                node = document.createElement(this.name);
            }
        }

        // carry over the attributes
        let attributes = this.node.getAttributeNames();
        attributes.forEach((attrName) => {
            node.setAttribute(attrName, this.node.getAttribute(attrName));
        });
        
        // prevent interferance

        //this.node = node.cloneNode(true);
        this.node = node;

        this.initNode();

        this.styleUpdate();

        if (this.parent) {
            if (this.disabled || (this.missingData() && this.parent.missingData() || ! this.show()) || (this.isFlatArrayItem() && this.parent.data().length - 1 < this.listIndex)) {
                this.inDOM = false;
                this.nodeRemove();
                return null;
            }
        }

        let isFlatArray = false;
        if (this.parentNode() != null) {
            //isFlatArray = this.parentNode().isList() && this.dataType() != 'object' && this.parent.data() instanceof Array;
            isFlatArray = this.isFlatArrayItem();
        }
        

        if (this.hasData() && (! isFlatArray || this.isFlatArrayItemValue()) && ! this.ignoredTag()) {

            let dType = this.dataType();

            if (['string', 'number'].indexOf(dType) > -1) {
                if (this.HTMLData) {
                    let containerTmp = document.createElement('div');
                    containerTmp.innerHTML = this.data().toString();
                    for (let i = containerTmp.childNodes.length - 1; i > -1; i--) {
                        node.appendChild(containerTmp.childNodes[containerTmp.childNodes.length - i - 1]);
                    }
                } else {
                    // string or number, set as node textContent
                    let text = document.createTextNode(this.data().toString())
                    node.appendChild(text);
                }
            }
        }

        for (let i = 0; i < this.children.length; i++) {
            let child = this.children[i];
            if (child instanceof DViewNode) {
                let childDOM = child.dom();
                if (childDOM !== null) {
                    node.appendChild(childDOM);
                }
            } else {
                node.appendChild(child);
            }
        }

        this.inDOM = true;
        return node;
    }

    initNode() {
        // d-model
        if (this.node.hasAttribute('d-model')) {
            let model = this.node.getAttribute('d-model');
            this.node.addEventListener('input', () => {

                let data, node, key;

                if (model.indexOf('.') > -1) {
                    let path = model.split('.');
                    key = path.pop();
                    node = this.root().query(path);
                } else {
                    node = this;
                    key = model;
                }

                data = node.data();

                if (node.missingData()) {
                    node.parent.data().setVal(node.name, new DViewData(this.dview));
                }
                data = node.data();

                data.setVal(key, this.node.value);


            });
        }

        if (! this.initialized) {

            this.classNamesOriginal = this.node.className.split(' ').filter((className) => {
                return className.length > 0;
            });

            // d-if
            if (this.node.hasAttribute('d-if')) {
                let ifData = this.node.getAttribute('d-if').toLowerCase();
                let negate = false;
                if (ifData.indexOf('!') > -1) {
                    // negate
                    negate = true;
                    ifData = /!(.+)/.exec(ifData)[1].trim();
                }
    
                let dataPath = ifData.split('.');
    
                let dataObject = null;
                let dataKey = null;
    
                if (dataPath.length == 1) {
                    // no dots, use dview.data and path as key
                    dataObject = this.data();
                    dataKey = dataPath[0];
                } else {
                    dataKey = dataPath.pop();
                    dataObject = null;
                }

                if (dataObject == null) {
                    dataObject = this.root().query(dataPath).data();
                }

                if ((dataObject instanceof DViewData && typeof dataObject.data[dataKey] === 'function') || typeof dataObject[dataKey] === 'function') {
                    let callback = (typeof dataObject[dataKey] === 'function') ? dataObject[dataKey] : dataObject.data[dataKey];
                    if (! negate) {
                        this.showCondition = function() {
                            return callback.apply(this, []);
                        }
                    } else {
                        this.showCondition = function() {
                            return ! callback.apply(this, []);
                        }
                    }
                    this.showConditionData = null;
                    this.showConditionKey = null;
                    dataObject.uses(this, '*');
                } else {
                    this.showConditionData = dataObject;
                    this.showConditionKey = dataKey;
                    
                    if (negate) {
                        this.showCondition = function(val) {
                            return ! val;
                        }
                    } else {
                        this.showCondition = function(val) {
                            return val;
                        };
                    }
                    if (dataObject instanceof DViewData) {
                        dataObject.uses(this, dataKey);
                    }
                }
    
    
            }

            // d-ignore
            if (this.node.hasAttribute('d-ignore')) {
                this.ignored = true;
            }

        }

        if (! this.clickInitialized) {
            // d-click
            if (this.node.hasAttribute('d-click')) {
                let action = this.node.getAttribute('d-click');
                this.node.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.dview.exec(action, [this.dview.objectModel, this]);
                });
            }
            this.clickInitialized = true;
        }

        // HTMLData d-html
        if (this.node.hasAttribute('d-html')) {
            this.HTMLData = true;
        }

        this.initialized = true;

        // init children recursively
        for (let i = 0; i < this.children.length; i++) {
            if (this.children[i] instanceof DViewNode) {
                this.children[i].initNode();
            }
        }

    }

    listNode() {
        let DOMNode = null;
        for (var i = 0; i < this.nodeOriginal.childNodes.length; i++) {
            if (this.nodeOriginal.childNodes[i].nodeType == 1) {
                DOMNode = this.nodeOriginal.childNodes[i];
                break;
            }
        }
        return DOMNode;
    }

    // on a direct child of a flat array list one could just use .listIndex property
    // if the node is nested inside such list item we may want to know the list index it has
    // returns .listIndex property, if null then returns .listIndex of the first parent that has it, if no such parent was found then returns null
    getListIndex() {
        if (this.listIndex !== null) {
            return this.listIndex;
        }

        let node = this.parent;
        while (node !== null) {
            if (node.listIndex !== null) {
                return node.listIndex;
            }
            node = node.parent;
        }
        return null;
    }

    hasData() {
        return this.dataType() !== 'undefined';
    }

    dataType() {
        return typeof this.data();
    }

    data() {

        if (this.dataCached !== null) {return this.dataCached;}

        let raw = this.dataRaw();

        if (raw === null) {return null;}

        if (raw instanceof DViewData) {
            return raw;
        }

        if (typeof raw === 'function') {
            if (! this.computedDataSubscribed) {
                this.subscribe(this.parentNode().data(), '*');
                this.computedDataSubscribed = true;
            }
            return raw.apply(this.dview, []);
        }

        if (typeof raw === 'object' && ! (raw instanceof Array)) {
            let keys = Object.keys(raw);
            for (let i = 0; i < keys.length; i++) {
                let keyLower = keys[i].toLowerCase();
                if (keyLower !== keys[i]) {
                    // isnt lower, lower it
                    raw[keyLower] = raw[keys[i]];
                    delete raw[keys[i]];
                }
            }
        }

        // cache data
        if (this.isDataNode()) {
            this.dataCached = raw;
        }

        return raw;
    }

    dataRaw() {
        if (this.name == 'body' && this.parent == null) {
            return this.dview.data;
        }

        // only should be the case with components
        if (this.parent == null) {
            return null;
        }

        let source = this.parent.data();

        let data;
        
        if (typeof this.listIndex === 'number' && this.parent.data() instanceof Array) {
            data = source[this.listIndex];
        } else {
            if (typeof source === 'undefined' || source === null) {
                return this.parent.data();
            }
            if (typeof source[this.name] === 'undefined') {
                return source;
            }
            data = source[this.name];
        }

        return data;
    }

    isList() {
        return (this.data() instanceof Array);
    }

    redraw() {

        this.dataCached = null;
        if (! this.dview.rendered) {return false;}

        this.clickInitialized = false;
        if (this.dview.debug) {
            console.log('redraw', this.name);
        }
        
        if (! this.show() && this.parent.nodeContains(this.node)) {
            try {
                this.node.parentNode.removeChild(this.node);
                this.clickInitialized = false;
                return false;
            } catch(e) {}
        }

        if (! this.show()) {return false;}

        if (this.isList()) {
            
            if (this.listItem === null) {
                if (this.debug) {
                    console.log('Trying to find list item for ' + this.name);
                }
                this.listItem = this.listNode().cloneNode(true);
            }
            
            this.childrenUpdate();
        }

        if (this.node.parentNode != null) {
            if (this.dview.debug) {
                console.log('C0');
            }
            try {
                this.clickInitialized = false;
                let oldNode = this.node;
                let nodeNew = this.dom();

                this.parent.node.insertBefore(nodeNew, oldNode);
                this.parent.node.removeChild(oldNode);
                this.node = nodeNew;
            } catch(e) {
                if (this.dview.debug) {
                    console.log(e);
                }
            }
        } else {

            try {
                this.parent.node.removeChild(this.node);
            } catch(e) {
                if (this.dview.debug) {
                    console.log(e);
                }
            }

            let parentChildIndex = this.parent.children.indexOf(this);
            this.clickInitialized = false;
            let domAdded = this.dom();
            if (domAdded != null && this.show() == true) {
                try {
                    this.parent.node.appendChild(this.node);
                    if (parentChildIndex == 0) {
                        if (this.parent.children[1]) {
                            let c = this.parent.children[1];
                            this.parent.node.insertBefore(this.node, c.node ? c.node : c);
                            if (this.dview.debug) {
                                console.log('c1.1');
                            }
                        } else {
                            this.parent.node.appendChild(this.node);
                            if (this.dview.debug) {
                                console.log('c1.2');
                            }
                        }
                    } else {
                        let c = this.parent.children[parentChildIndex + 1];
                        if (c.node) {
                            if (this.dview.debug) {
                                console.log('c2.1')
                            }
                            c.node.parentNode.insertBefore(this.node, c.node);
                        } else {
                            this.parent.node.insertBefore(this.node, c);
                            if (this.dview.debug) {
                                console.log('c2.2')
                            }
                        }
                    }
                } catch(e) {
                    if (this.dview.debug) {
                        console.log(e);
                    }
                }

                return false;
            }
        }
        
    }

    childrenUpdate() {
        try {
            let data = this.data();
            let node = (this.listItem || this.listNode());
            
            if (node == null) {return false;}

            let childNodes = this.childNodes();
            let childCount = childNodes.length;

            // if a child has been initialized before there was data for parent it may be missing the listIndex
            // this would happen if the parent's data is meant to be an array, but was not defined yet at the time the node was initialized
            let missingIndex = childNodes.some((child) => {
                return child.listIndex === null;
            });

            if (missingIndex) {
                // re-index nodes
                for (let i = 0; i < childCount; i++) {
                    childNodes[i].listIndex = i;
                }
            }

            if (data.length > childCount) {
                // add missing children
                for (let i = 0; i < data.length - childCount; i++) {
                    this.children.push(this.dview.parse(new DViewNode(this.dview, node.cloneNode(true), this.path.concat([this.name]), this, childCount + i), Array.from(this.path)));
                }
            }

            if (data.length < childCount) {
                // remove extra children
                let remove = childCount - data.length;
                let removed = 0;
                for (let i = this.children.length - 1; i > -1; i--) {
                    if (this.children[i] instanceof DViewNode) {
                        let child = this.children.splice(i, 1);
                        // unsubscribe the removed child
                        child[0].unsubscribe();
                        removed++;
                        if (remove == removed) {
                            break;
                        }
                    }
                }
            }

            
            this.childNodes().forEach((child) => {
                // clear children cache recursively
                child.cacheClear();
            });

        } catch(e) {
            if (this.dview.debug) {
                console.log(this.name, this, e);
            }
        }
    }

    subscribe(source, key) {
        if (source instanceof DViewData) {
            source.uses(this, key);
            this.dataSubscribed.push([source, key]);
        }
    }

    unsubscribe() {
        this.dataSubscribed.forEach((data) => {
            data[0].nodes = data[0].nodes.filter((node) => {
                return node[0] !== this;
            });
        });
    }

    queryOld(path, node) {

        if (typeof node === 'undefined') {
            node = this;
        }

        let current = path[0];
        let nodeFound = null;

        if (node.name == current) {
            nodeFound = node;
        }

        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i] instanceof DViewNode) {
                let childFound = this.query(path, node.children[i]);
                if (childFound !== null) {
                    nodeFound = childFound;
                }
            }
        }

        if (nodeFound !== null) {
            if (path.length > 1) {
                path.shift();
                return this.query(path, nodeFound);
            } else {
                return nodeFound;
            }
        }

        return null;
    }

    query(path) {
        let matches = this.queryAll(path, true);
        if (matches.length > 0) {
            return matches[0];
        }
        return null;
    }

    queryAll(path, exact, nodes) {

        if (typeof exact !== 'boolean') {
            exact = true;
        }

        if (! (nodes instanceof Array)) {
            nodes = [this];
        }

        let matches = [];

        let childNodes = [];
        for (let i = 0; i < nodes.length; i++) {
            if (this.dview.withinPathLoose(nodes[i].path.concat([nodes[i].name]), path)) {
                matches.push(nodes[i]);
            }
    
            childNodes = childNodes.concat(nodes[i].childNodes());
        }

        if (childNodes.length > 0) {
            matches = matches.concat(this.queryAll(path, exact, childNodes));
        }

        if (exact) {
            matches = matches.filter((match) => {
                return match.name == path[path.length - 1] || match.node.tagName.toLowerCase() == path[path - 1];
            });
        }

        return matches;
    }

    // return the first non ignored parent
    parentNode() {
        let parent = this;
        do {
            parent = parent.parent;
            if (parent == null) {
                return null;
            }
            if (parent.isDataNode() || parent.parent == null) {
                return parent;
            }
        } while(parent !== null);
        return null;
    }

    parentFind(name) {
        let parent = this;
        do {
            parent = parent.parent;
            if (parent == null) {
                return null;
            }
            if (parent.name == name) {
                return parent;
            }
        } while(parent !== null);
        return null;
    }

    parentWithData() {
        let node = this;
        do {
            node = node.parent;
            if (node.parent == null) {
                return node;
            }
            if (node.parent.data() != node.data()) {
                return node;
            }
        } while(true);
    }

    // children that are an instance of DViewNode
    childNodes() {
        return this.children.filter((child) => {
            return child instanceof DViewNode;
        });
    }

    childByData(data) {
        return this.childNodes().find((node) => {
            return node.data() === data;
        })
    }

    isDataNode() {
        // root
        if (this.parent == null) {return false;}
        return ! this.ignoredTag() && ! this.parent.isList() && typeof this.listIndex !== 'number';
    }

    missingData() {
        // root always has data
        if (this.parent == null) {return false;}
        return this.isDataNode() && this.data() == this.parent.data();
    }

    show() {
        if (this.showCondition === null) {
            return true;
        }
        let arg = [];
        if (this.showConditionData != null) {
            if (this.showConditionKey != null) {
                arg.push(this.showConditionData[this.showConditionKey]);
            } else {
                arg.push(this.showConditionData);
            }
        }

        arg.push(this);

        return this.showCondition.apply(this.dview, arg) == true;
    }

    destroy() {
        if (this.dview.debug) {
            console.log('destroyed ' + this.name);
        }
        this.destroyed = true;
        this.inDOM = false;
        this.nodeRemove();
        this.unsubscribe();
        this.redraw();
    }

    nodeContains(child) {
        for (let i = 0; i < this.node.childNodes.length; i++) {
            if (this.node.childNodes[i] == child) {
                return true;
            }
        }
        return false;
    }

    setShow(showCondition, data, value) {
        this.showCondition = showCondition;
        this.showConditionData = data;
        this.showConditionKey = value;
        this.redraw();

        // subscribed to data
        data.uses(this, value);
    }

    root() {
        if (this.dview.rendered) {
            return this.dview.objectModel;
        } else {
            let node = this;
            do {
                if (node.parent != null) {
                    node = node.parent;
                } else {
                    return node;
                }
            } while (node != null);
            return node;
        }
    }

    isFlatArrayItem() {
        let parentNode = this.parentNode();
        if (! parentNode) {
            return false;
        }
        return parentNode.isList() && this.parent.data() instanceof Array && this.dataType() !== 'object';
    }

    isFlatArrayItemValue() {
        return this.isFlatArrayItem() && this.name == 'item';
    }

    ignoredTag() {
        return this.ignored || this.dview.ignoreTags.indexOf(this.name) > -1;
    }

    // get own style rules
    styles() {
        return this.dview.styles.filter((style) => {
            return this.dview.withinPathLoose(this.path.concat([this.name]), style.path);
        });
    }

    // returns an array of all the class names the node should be rendered with
    getClassNames() {
        let styles = this.styles();

        let classNamesNode = [];
        if (this.classNamesOriginal) {
            classNamesNode = classNamesNode.concat(this.classNamesOriginal);
        }

        styles.forEach((s) => {
            let classNames = Object.keys(s.styles);
            classNames.forEach((className) => {
                if (s.styles[className].apply(this.dview, [this])) {
                    classNamesNode.push(className);
                }
            });
        });

        return classNamesNode;
    }

    // set the class attribute with original + dynamic class names
    styleUpdate() {
        this.node.className = this.getClassNames().join(' ');
    }

    // remove node from DOM tree
    nodeRemove() {
        try {
            this.parent.node.removeChild(this.node);
        } catch(e) {}
    }

    // clears the node's cached data, and recursively down the DOM tree
    cacheClear() {
        this.dataCached = null;
        this.childNodes().forEach((child) => {
            child.cacheClear();
        });
    }

    // clone node and it's children recursively
    clone() {
        let node = new DViewNode(this.dview, this.nodeOriginal.cloneNode(true), Array.from(this.path), this.parent, this.listIndex);
        node.children = Array.from(this.children);

        node.showCondition = this.showCondition;
        node.showConditionData = this.showConditionData;
        node.showConditionKey = this.showConditionKey;

        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i] instanceof DViewNode) {
                node.children[i] = node.children[i].clone();
                node.children[i].parent = node;
            } else {
                node.children[i] = node.children[i].cloneNode(true);
            }
        }

        return node;
    }

    // set node's path, and update children paths recurively
    pathSet(path) {
        path = Array.from(path);
        this.path = Array.from(path);
        path.push(this.name);
        this.childNodes().forEach((child) => {
            child.pathSet(path);
        });
    }
}