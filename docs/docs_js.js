window.addEventListener('DOMContentLoaded', async function() {
    // init DView
    window.d = new DView({
        hideNotDirectlyUsed : true,
        pageRenderTime : 0,
        searchString : '',
        attributes : [],
        pageAttributes : function() {
            return this.data.page === 'attributes';
        },
        pageMethods : function() {
            return this.data.page === 'methods';
        },
        pageProperties : function() {
            return this.data.page === 'properties';
        },
        page : 'methods',
        classes : function() {
            let classes = this.data.classesRaw;
            for (let i = 0; i < classes.length; i++) {
                // sort methods by name
                let methods = classes[i].methods;
                methods.sort((a, b) => {
                    return a.name.toLowerCase().charCodeAt(0) - b.name.toLowerCase().charCodeAt(0);
                });
            }
            return classes;
        },
        classesRaw : []
    }, {
        toggleIndirectlyUsed : function() {
            this.data.hideNotDirectlyUsed = ! this.data.hideNotDirectlyUsed;
        },
        goToMethod : function(root, node) {
            let methods = d.queryAll(['docs', 'class', 'method']);
            let foundMethod = methods.find((method) => {
                return method.data() == node.data();
            });
            if (foundMethod) {
                let pos = foundMethod.node.getBoundingClientRect();
                nodeHighlight(foundMethod.node);
                window.scrollTo(0, window.scrollY + pos.y);
            }
        },
        goToProperty : function(root, node) {
            let properties = d.queryAll(['docs', 'class', 'property']);
            let foundProp = properties.find((prop) => {
                return prop.data() == node.data();
            });
            if (foundProp) {
                let pos = foundProp.node.getBoundingClientRect();
                nodeHighlight(foundProp.node);
                window.scrollTo(0, window.scrollY + pos.y);
            }
        },
        goToClass : function(root, node) {
            let classes = d.queryAll(['docs', 'class']);
            let foundClass = classes.find((classNode) => {
                return classNode.data().name == node.data();
            });
            if (foundClass) {
                let pos = foundClass.node.getBoundingClientRect();
                nodeHighlight(foundClass.node);
                window.scrollTo(0, window.scrollY + pos.y);
            }
        },
        searchClear : function() {
            this.data.searchString = '';
            this.query(['search', 'input']).node.value = '';
        }
    },
    // dynamic styles
    {
        'methods.method' : {
            'text-secondary' : function(node) {
                return node.data().directuse == false;
            },
            'd-none' : function(node) {
                if (node.name != 'method') {return false;}
                
                // hide those not matching searchString
                if (this.data.searchString) {
                    if (node.data().name.toLowerCase().indexOf(this.data.searchString.toLowerCase()) == -1) {
                        return true;
                    } else {
                        // show non direcly used methods if they match a search even if hideNotDirectlyUsed is true
                        return false;
                    }
                }
                // show directly used, unless user selected otherwise
                if (node.data().directuse) {return false;}

                return this.data.hideNotDirectlyUsed != false;
            }
        },

        'properties.property' : {
            'text-secondary' : function(node) {
                return node.data().directuse == false;
            },
            'd-none' : function(node) {
                if (node.name != 'property') {return false;}
                
                // hide those not matching searchString
                if (this.data.searchString) {
                    if (node.data().name.toLowerCase().indexOf(this.data.searchString.toLowerCase()) == -1) {
                        return true;
                    } else {
                        // show non direcly used methods if they match a search even if hideNotDirectlyUsed is true
                        return false;
                    }
                }
                // show directly used, unless user selected otherwise
                if (node.data().directuse) {return false;}

                return this.data.hideNotDirectlyUsed != false;
            }
        },

        'search' : {
            'd-none' : function() {
                return this.data.page === 'attributes';
            }
        }
    });

    d.data.pageRenderTime = d.benchmarkTime();

    // load docs
    let docs = await loadData();

    // sort properties by name
    docs.classes.forEach((classItem) => {
        classItem.properties.sort((a, b) => {
            return a.name.toLowerCase().charCodeAt(0) - b.name.toLowerCase().charCodeAt(0);
        });
    });

    d.data.setVal('classesRaw', docs.classes);
    d.data.setVal('attributes', docs.attributes);
    d.queryAll(['classes']).forEach((classNode) => {
        classNode.redraw();
    });
    d.queryAll(['attributes']).forEach((attr) => {
        attr.redraw();
    });

    // show only classes with at least one match
    let classes = d.queryAll(['class']);
    for (let i = 0; i < classes.length; i++) {
        classes[i].setShow(
            function (searchString, node) {
                if (searchString.trim().length == 0) {return true;}
                if (this.data.page == 'methods') {
                    return node.data().methods.some(function(method) {
                        return method.name.toLowerCase().indexOf(searchString.toLowerCase()) > -1;
                    });
                }
                if (this.data.page == 'properties') {
                    if (node.data().properties.length == 0) {return false;}
                    return node.data().properties.some(function(prop) {
                        return prop.name.toLowerCase().indexOf(searchString.toLowerCase()) > -1;
                    });
                }
            },
            d.data,
            'searchstring'
        );
    }


    // page select dropdown
    let pageDropdown = d.query(['index', 'select']);
    pageDropdown.node.addEventListener('change', function() {
        d.data.page = pageDropdown.node.value;
    });
});

function loadData() {
    return new Promise((resolve, reject) => {
        let req = new XMLHttpRequest();
        req.open('GET', 'docs.json');

        req.onreadystatechange = function() {
            if (req.readyState == 4) {
                resolve(JSON.parse(req.responseText));
            }
        }

        req.send();
    });
}

function nodeHighlight(node, start) {
    let t = new Date().getTime();
    if (typeof start !== 'number') {
        start = new Date().getTime();
    }

    let duration = 1200;

    let animatedTime = t - start;
    let animatedPerc = Math.min(1, animatedTime / duration);

    let opacity = 1 - animatedPerc;

    let borderColor = `rgba(0, 0, 0, ${opacity})`;

    node.style.border = '1px solid ' + borderColor;

    if (animatedPerc < 1) {
        setTimeout(() => {
            nodeHighlight(node, start);
        });
    }
}