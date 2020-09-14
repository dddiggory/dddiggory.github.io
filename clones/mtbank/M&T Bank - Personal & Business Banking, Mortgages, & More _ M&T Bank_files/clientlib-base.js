/*******************************************************************************
 * Copyright 2017 Adobe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
if (window.Element && !Element.prototype.closest) {
    // eslint valid-jsdoc: "off"
    Element.prototype.closest =
        function(s) {
            "use strict";
            var matches = (this.document || this.ownerDocument).querySelectorAll(s);
            var el      = this;
            var i;
            do {
                i = matches.length;
                while (--i >= 0 && matches.item(i) !== el) {
                    // continue
                }
            } while ((i < 0) && (el = el.parentElement));
            return el;
        };
}

if (window.Element && !Element.prototype.matches) {
    Element.prototype.matches =
        Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.oMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function(s) {
            "use strict";
            var matches = (this.document || this.ownerDocument).querySelectorAll(s);
            var i       = matches.length;
            while (--i >= 0 && matches.item(i) !== this) {
                // continue
            }
            return i > -1;
        };
}

if (!Object.assign) {
    Object.assign = function(target, varArgs) { // .length of function is 2
        "use strict";
        if (target === null) {
            throw new TypeError("Cannot convert undefined or null to object");
        }

        var to = Object(target);

        for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];

            if (nextSource !== null) {
                for (var nextKey in nextSource) {
                    if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
        }
        return to;
    };
}

(function(arr) {
    "use strict";
    arr.forEach(function(item) {
        if (item.hasOwnProperty("remove")) {
            return;
        }
        Object.defineProperty(item, "remove", {
            configurable: true,
            enumerable: true,
            writable: true,
            value: function remove() {
                this.parentNode.removeChild(this);
            }
        });
    });
})([Element.prototype, CharacterData.prototype, DocumentType.prototype]);

/*******************************************************************************
 * Copyright 2016 Adobe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
(function() {
    "use strict";

    var NS = "cmp";
    var IS = "image";

    var EMPTY_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    var LAZY_THRESHOLD = 0;
    var SRC_URI_TEMPLATE_WIDTH_VAR = "{.width}";

    var selectors = {
        self: "[data-" + NS + '-is="' + IS + '"]',
        image: '[data-cmp-hook-image="image"]',
        map: '[data-cmp-hook-image="map"]',
        area: '[data-cmp-hook-image="area"]'
    };

    var lazyLoader = {
        "cssClass": "cmp-image__image--is-loading",
        "style": {
            "height": 0,
            "padding-bottom": "" // will be replaced with % ratio
        }
    };

    var properties = {
        /**
         * An array of alternative image widths (in pixels).
         * Used to replace a {.width} variable in the src property with an optimal width if a URI template is provided.
         *
         * @memberof Image
         * @type {Number[]}
         * @default []
         */
        "widths": {
            "default": [],
            "transform": function(value) {
                var widths = [];
                value.split(",").forEach(function(item) {
                    item = parseFloat(item);
                    if (!isNaN(item)) {
                        widths.push(item);
                    }
                });
                return widths;
            }
        },
        /**
         * Indicates whether the image should be rendered lazily.
         *
         * @memberof Image
         * @type {Boolean}
         * @default false
         */
        "lazy": {
            "default": false,
            "transform": function(value) {
                return !(value === null || typeof value === "undefined");
            }
        },
        /**
         * The image source.
         *
         * Can be a simple image source, or a URI template representation that
         * can be variable expanded - useful for building an image configuration with an alternative width.
         * e.g. '/path/image.coreimg{.width}.jpeg/1506620954214.jpeg'
         *
         * @memberof Image
         * @type {String}
         */
        "src": {
        }
    };

    var devicePixelRatio = window.devicePixelRatio || 1;

    function readData(element) {
        var data = element.dataset;
        var options = [];
        var capitalized = IS;
        capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
        var reserved = ["is", "hook" + capitalized];

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var value = data[key];

                if (key.indexOf(NS) === 0) {
                    key = key.slice(NS.length);
                    key = key.charAt(0).toLowerCase() + key.substring(1);

                    if (reserved.indexOf(key) === -1) {
                        options[key] = value;
                    }
                }
            }
        }

        return options;
    }

    function Image(config) {
        var that = this;

        function init(config) {
            // prevents multiple initialization
            config.element.removeAttribute("data-" + NS + "-is");

            setupProperties(config.options);
            cacheElements(config.element);

            if (!that._elements.noscript) {
                return;
            }

            that._elements.container = that._elements.link ? that._elements.link : that._elements.self;

            unwrapNoScript();

            if (that._properties.lazy) {
                addLazyLoader();
            }

            if (that._elements.map) {
                that._elements.image.addEventListener("load", onLoad);
            }

            window.addEventListener("scroll", that.update);
            window.addEventListener("resize", onWindowResize);
            window.addEventListener("update", that.update);
            that._elements.image.addEventListener("cmp-image-redraw", that.update);
            that.update();
        }

        function loadImage() {
            var hasWidths = that._properties.widths && that._properties.widths.length > 0;
            var replacement = hasWidths ? "." + getOptimalWidth() : "";
            var url = that._properties.src.replace(SRC_URI_TEMPLATE_WIDTH_VAR, replacement);

            if (that._elements.image.getAttribute("src") !== url) {
                that._elements.image.setAttribute("src", url);
                if (!hasWidths) {
                    window.removeEventListener("scroll", that.update);
                }
            }

            if (that._lazyLoaderShowing) {
                that._elements.image.addEventListener("load", removeLazyLoader);
            }
        }

        function getOptimalWidth() {
            var container = that._elements.self;
            var containerWidth = container.clientWidth;
            while (containerWidth === 0 && container.parentNode) {
                container = container.parentNode;
                containerWidth = container.clientWidth;
            }
            var optimalWidth = containerWidth * devicePixelRatio;
            var len = that._properties.widths.length;
            var key = 0;

            while ((key < len - 1) && (that._properties.widths[key] < optimalWidth)) {
                key++;
            }

            return that._properties.widths[key].toString();
        }

        function addLazyLoader() {
            var width = that._elements.image.getAttribute("width");
            var height = that._elements.image.getAttribute("height");

            if (width && height) {
                var ratio = (height / width) * 100;
                var styles = lazyLoader.style;

                styles["padding-bottom"] = ratio + "%";

                for (var s in styles) {
                    if (styles.hasOwnProperty(s)) {
                        that._elements.image.style[s] = styles[s];
                    }
                }
            }
            that._elements.image.setAttribute("src", EMPTY_PIXEL);
            that._elements.image.classList.add(lazyLoader.cssClass);
            that._lazyLoaderShowing = true;
        }

        function unwrapNoScript() {
            var markup = decodeNoscript(that._elements.noscript.textContent.trim());
            var parser = new DOMParser();

            // temporary document avoids requesting the image before removing its src
            var temporaryDocument = parser.parseFromString(markup, "text/html");
            var imageElement = temporaryDocument.querySelector(selectors.image);
            imageElement.removeAttribute("src");
            that._elements.container.insertBefore(imageElement, that._elements.noscript);

            var mapElement = temporaryDocument.querySelector(selectors.map);
            if (mapElement) {
                that._elements.container.insertBefore(mapElement, that._elements.noscript);
            }

            that._elements.noscript.parentNode.removeChild(that._elements.noscript);
            if (that._elements.container.matches(selectors.image)) {
                that._elements.image = that._elements.container;
            } else {
                that._elements.image = that._elements.container.querySelector(selectors.image);
            }

            that._elements.map = that._elements.container.querySelector(selectors.map);
            that._elements.areas = that._elements.container.querySelectorAll(selectors.area);
        }

        function removeLazyLoader() {
            that._elements.image.classList.remove(lazyLoader.cssClass);
            for (var property in lazyLoader.style) {
                if (lazyLoader.style.hasOwnProperty(property)) {
                    that._elements.image.style[property] = "";
                }
            }
            that._elements.image.removeEventListener("load", removeLazyLoader);
            that._lazyLoaderShowing = false;
        }

        function isLazyVisible() {
            if (that._elements.container.offsetParent === null) {
                return false;
            }

            var wt = window.pageYOffset;
            var wb = wt + document.documentElement.clientHeight;
            var et = that._elements.container.getBoundingClientRect().top + wt;
            var eb = et + that._elements.container.clientHeight;

            return eb >= wt - LAZY_THRESHOLD && et <= wb + LAZY_THRESHOLD;
        }

        function resizeAreas() {
            if (that._elements.areas && that._elements.areas.length > 0) {
                for (var i = 0; i < that._elements.areas.length; i++) {
                    var width = that._elements.image.width;
                    var height = that._elements.image.height;

                    if (width && height) {
                        var relcoords = that._elements.areas[i].dataset.cmpRelcoords;
                        if (relcoords) {
                            var relativeCoordinates = relcoords.split(",");
                            var coordinates = new Array(relativeCoordinates.length);

                            for (var j = 0; j < coordinates.length; j++) {
                                if (j % 2 === 0) {
                                    coordinates[j] = parseInt(relativeCoordinates[j] * width);
                                } else {
                                    coordinates[j] = parseInt(relativeCoordinates[j] * height);
                                }
                            }

                            that._elements.areas[i].coords = coordinates;
                        }
                    }
                }
            }
        }

        function cacheElements(wrapper) {
            that._elements = {};
            that._elements.self = wrapper;
            var hooks = that._elements.self.querySelectorAll("[data-" + NS + "-hook-" + IS + "]");

            for (var i = 0; i < hooks.length; i++) {
                var hook = hooks[i];
                var capitalized = IS;
                capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
                var key = hook.dataset[NS + "Hook" + capitalized];
                that._elements[key] = hook;
            }
        }

        function setupProperties(options) {
            that._properties = {};

            for (var key in properties) {
                if (properties.hasOwnProperty(key)) {
                    var property = properties[key];
                    if (options && options[key] != null) {
                        if (property && typeof property.transform === "function") {
                            that._properties[key] = property.transform(options[key]);
                        } else {
                            that._properties[key] = options[key];
                        }
                    } else {
                        that._properties[key] = properties[key]["default"];
                    }
                }
            }
        }

        function onWindowResize() {
            that.update();
            resizeAreas();
        }

        function onLoad() {
            resizeAreas();
        }

        that.update = function() {
            if (that._properties.lazy) {
                if (isLazyVisible()) {
                    loadImage();
                }
            } else {
                loadImage();
            }
        };

        if (config && config.element) {
            init(config);
        }
    }

    function onDocumentReady() {
        var elements = document.querySelectorAll(selectors.self);
        for (var i = 0; i < elements.length; i++) {
            new Image({ element: elements[i], options: readData(elements[i]) });
        }

        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        var body             = document.querySelector("body");
        var observer         = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // needed for IE
                var nodesArray = [].slice.call(mutation.addedNodes);
                if (nodesArray.length > 0) {
                    nodesArray.forEach(function(addedNode) {
                        if (addedNode.querySelectorAll) {
                            var elementsArray = [].slice.call(addedNode.querySelectorAll(selectors.self));
                            elementsArray.forEach(function(element) {
                                new Image({ element: element, options: readData(element) });
                            });
                        }
                    });
                }
            });
        });

        observer.observe(body, {
            subtree: true,
            childList: true,
            characterData: true
        });
    }

    if (document.readyState !== "loading") {
        onDocumentReady();
    } else {
        document.addEventListener("DOMContentLoaded", onDocumentReady);
    }

    /*
        on drag & drop of the component into a parsys, noscript's content will be escaped multiple times by the editor which creates
        the DOM for editing; the HTML parser cannot be used here due to the multiple escaping
     */
    function decodeNoscript(text) {
        text = text.replace(/&(amp;)*lt;/g, "<");
        text = text.replace(/&(amp;)*gt;/g, ">");
        return text;
    }

})();

/*******************************************************************************
 * Copyright 2017 Adobe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
(function() {
    "use strict";

    var NS = "cmp";
    var IS = "search";

    var DELAY = 300; // time before fetching new results when the user is typing a search string
    var LOADING_DISPLAY_DELAY = 300; // minimum time during which the loading indicator is displayed
    var PARAM_RESULTS_OFFSET = "resultsOffset";

    var keyCodes = {
        TAB: 9,
        ENTER: 13,
        ESCAPE: 27,
        ARROW_UP: 38,
        ARROW_DOWN: 40
    };

    var selectors = {
        self: "[data-" + NS + '-is="' + IS + '"]',
        item: {
            self: "[data-" + NS + "-hook-" + IS + '="item"]',
            title: "[data-" + NS + "-hook-" + IS + '="itemTitle"]',
            focused: "." + NS + "-search__item--is-focused"
        }
    };

    var properties = {
        /**
         * The minimum required length of the search term before results are fetched.
         *
         * @memberof Search
         * @type {Number}
         * @default 3
         */
        minLength: {
            "default": 3,
            transform: function(value) {
                value = parseFloat(value);
                return isNaN(value) ? null : value;
            }
        },
        /**
         * The maximal number of results fetched by a search request.
         *
         * @memberof Search
         * @type {Number}
         * @default 10
         */
        resultsSize: {
            "default": 10,
            transform: function(value) {
                value = parseFloat(value);
                return isNaN(value) ? null : value;
            }
        }
    };

    var idCount = 0;

    function readData(element) {
        var data = element.dataset;
        var options = [];
        var capitalized = IS;
        capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
        var reserved = ["is", "hook" + capitalized];

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var value = data[key];

                if (key.indexOf(NS) === 0) {
                    key = key.slice(NS.length);
                    key = key.charAt(0).toLowerCase() + key.substring(1);

                    if (reserved.indexOf(key) === -1) {
                        options[key] = value;
                    }
                }
            }
        }

        return options;
    }

    function toggleShow(element, show) {
        if (element) {
            if (show !== false) {
                element.style.display = "block";
                element.setAttribute("aria-hidden", false);
            } else {
                element.style.display = "none";
                element.setAttribute("aria-hidden", true);
            }
        }
    }

    function serialize(form) {
        var query = [];
        if (form && form.elements) {
            for (var i = 0; i < form.elements.length; i++) {
                var node = form.elements[i];
                if (!node.disabled && node.name) {
                    var param = [node.name, encodeURIComponent(node.value)];
                    query.push(param.join("="));
                }
            }
        }
        return query.join("&");
    }

    function mark(node, regex) {
        if (!node || !regex) {
            return;
        }

        // text nodes
        if (node.nodeType === 3) {
            var nodeValue = node.nodeValue;
            var match = regex.exec(nodeValue);

            if (nodeValue && match) {
                var element = document.createElement("mark");
                element.className = NS + "-search__item-mark";
                element.appendChild(document.createTextNode(match[0]));

                var after = node.splitText(match.index);
                after.nodeValue = after.nodeValue.substring(match[0].length);
                node.parentNode.insertBefore(element, after);
            }
        } else if (node.hasChildNodes()) {
            for (var i = 0; i < node.childNodes.length; i++) {
                // recurse
                mark(node.childNodes[i], regex);
            }
        }
    }

    function Search(config) {
        if (config.element) {
            // prevents multiple initialization
            config.element.removeAttribute("data-" + NS + "-is");
        }

        this._cacheElements(config.element);
        this._setupProperties(config.options);

        this._action = this._elements.form.getAttribute("action");
        this._resultsOffset = 0;
        this._hasMoreResults = true;

        this._elements.input.addEventListener("input", this._onInput.bind(this));
        this._elements.input.addEventListener("focus", this._onInput.bind(this));
        this._elements.input.addEventListener("keydown", this._onKeydown.bind(this));
        this._elements.clear.addEventListener("click", this._onClearClick.bind(this));
        document.addEventListener("click", this._onDocumentClick.bind(this));
        this._elements.results.addEventListener("scroll", this._onScroll.bind(this));

        this._makeAccessible();
    }

    Search.prototype._displayResults = function() {
        if (this._elements.input.value.length === 0) {
            toggleShow(this._elements.clear, false);
            this._cancelResults();
        } else if (this._elements.input.value.length < this._properties.minLength) {
            toggleShow(this._elements.clear, true);
        } else {
            this._updateResults();
            toggleShow(this._elements.clear, true);
        }
    };

    Search.prototype._onScroll = function(event) {
        // fetch new results when the results to be scrolled down are less than the visible results
        if (this._elements.results.scrollTop + 2 * this._elements.results.clientHeight >= this._elements.results.scrollHeight) {
            this._resultsOffset += this._properties.resultsSize;
            this._displayResults();
        }
    };

    Search.prototype._onInput = function(event) {
        var self = this;
        self._cancelResults();
        // start searching when the search term reaches the minimum length
        this._timeout = setTimeout(function() {
            self._displayResults();
        }, DELAY);
    };

    Search.prototype._onKeydown = function(event) {
        var self = this;

        switch (event.keyCode) {
            case keyCodes.TAB:
                if (self._resultsOpen()) {
                    event.preventDefault();
                }
                break;
            case keyCodes.ENTER:
                event.preventDefault();
                if (self._resultsOpen()) {
                    var focused = self._elements.results.querySelector(selectors.item.focused);
                    if (focused) {
                        focused.click();
                    }
                }
                break;
            case keyCodes.ESCAPE:
                self._cancelResults();
                break;
            case keyCodes.ARROW_UP:
                if (self._resultsOpen()) {
                    event.preventDefault();
                    self._stepResultFocus(true);
                }
                break;
            case keyCodes.ARROW_DOWN:
                if (self._resultsOpen()) {
                    event.preventDefault();
                    self._stepResultFocus();
                } else {
                    // test the input and if necessary fetch and display the results
                    self._onInput();
                }
                break;
            default:
                return;
        }
    };

    Search.prototype._onClearClick = function(event) {
        event.preventDefault();
        this._elements.input.value = "";
        toggleShow(this._elements.clear, false);
        toggleShow(this._elements.results, false);
    };

    Search.prototype._onDocumentClick = function(event) {
        var inputContainsTarget =  this._elements.input.contains(event.target);
        var resultsContainTarget = this._elements.results.contains(event.target);

        if (!(inputContainsTarget || resultsContainTarget)) {
            toggleShow(this._elements.results, false);
        }
    };

    Search.prototype._resultsOpen = function() {
        return this._elements.results.style.display !== "none";
    };

    Search.prototype._makeAccessible = function() {
        var id = NS + "-search-results-" + idCount;
        this._elements.input.setAttribute("aria-owns", id);
        this._elements.results.id = id;
        idCount++;
    };

    Search.prototype._generateItems = function(data, results) {
        var self = this;

        data.forEach(function(item) {
            var el = document.createElement("span");
            el.innerHTML = self._elements.itemTemplate.innerHTML;
            el.querySelectorAll(selectors.item.title)[0].appendChild(document.createTextNode(item.title));
            el.querySelectorAll(selectors.item.self)[0].setAttribute("href", item.url);
            results.innerHTML += el.innerHTML;
        });
    };

    Search.prototype._markResults = function() {
        var nodeList = this._elements.results.querySelectorAll(selectors.item.self);
        var escapedTerm = this._elements.input.value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        var regex = new RegExp("(" + escapedTerm + ")", "gi");

        for (var i = this._resultsOffset - 1; i < nodeList.length; ++i) {
            var result = nodeList[i];
            mark(result, regex);
        }
    };

    Search.prototype._stepResultFocus = function(reverse) {
        var results = this._elements.results.querySelectorAll(selectors.item.self);
        var focused = this._elements.results.querySelector(selectors.item.focused);
        var newFocused;
        var index = Array.prototype.indexOf.call(results, focused);
        var focusedCssClass = NS + "-search__item--is-focused";

        if (results.length > 0) {

            if (!reverse) {
                // highlight the next result
                if (index < 0) {
                    results[0].classList.add(focusedCssClass);
                } else if (index + 1 < results.length) {
                    results[index].classList.remove(focusedCssClass);
                    results[index + 1].classList.add(focusedCssClass);
                }

                // if the last visible result is partially hidden, scroll up until it's completely visible
                newFocused = this._elements.results.querySelector(selectors.item.focused);
                if (newFocused) {
                    var bottomHiddenHeight = newFocused.offsetTop + newFocused.offsetHeight - this._elements.results.scrollTop - this._elements.results.clientHeight;
                    if (bottomHiddenHeight > 0) {
                        this._elements.results.scrollTop += bottomHiddenHeight;
                    } else {
                        this._onScroll();
                    }
                }

            } else {
                // highlight the previous result
                if (index >= 1) {
                    results[index].classList.remove(focusedCssClass);
                    results[index - 1].classList.add(focusedCssClass);
                }

                // if the first visible result is partially hidden, scroll down until it's completely visible
                newFocused = this._elements.results.querySelector(selectors.item.focused);
                if (newFocused) {
                    var topHiddenHeight = this._elements.results.scrollTop - newFocused.offsetTop;
                    if (topHiddenHeight > 0) {
                        this._elements.results.scrollTop -= topHiddenHeight;
                    }
                }
            }
        }
    };

    Search.prototype._updateResults = function() {
        var self = this;
        if (self._hasMoreResults) {
            var request = new XMLHttpRequest();
            var url = self._action + "?" + serialize(self._elements.form) + "&" + PARAM_RESULTS_OFFSET + "=" + self._resultsOffset;

            request.open("GET", url, true);
            request.onload = function() {
                // when the results are loaded: hide the loading indicator and display the search icon after a minimum period
                setTimeout(function() {
                    toggleShow(self._elements.loadingIndicator, false);
                    toggleShow(self._elements.icon, true);
                }, LOADING_DISPLAY_DELAY);
                if (request.status >= 200 && request.status < 400) {
                    // success status
                    var data = JSON.parse(request.responseText);
                    if (data.length > 0) {
                        self._generateItems(data, self._elements.results);
                        self._markResults();
                        toggleShow(self._elements.results, true);
                    } else {
                        self._hasMoreResults = false;
                    }
                    // the total number of results is not a multiple of the fetched results:
                    // -> we reached the end of the query
                    if (self._elements.results.querySelectorAll(selectors.item.self).length % self._properties.resultsSize > 0) {
                        self._hasMoreResults = false;
                    }
                } else {
                    // error status
                }
            };
            // when the results are loading: display the loading indicator and hide the search icon
            toggleShow(self._elements.loadingIndicator, true);
            toggleShow(self._elements.icon, false);
            request.send();
        }
    };

    Search.prototype._cancelResults = function() {
        clearTimeout(this._timeout);
        this._elements.results.scrollTop = 0;
        this._resultsOffset = 0;
        this._hasMoreResults = true;
        this._elements.results.innerHTML = "";
    };

    Search.prototype._cacheElements = function(wrapper) {
        this._elements = {};
        this._elements.self = wrapper;
        var hooks = this._elements.self.querySelectorAll("[data-" + NS + "-hook-" + IS + "]");

        for (var i = 0; i < hooks.length; i++) {
            var hook = hooks[i];
            var capitalized = IS;
            capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
            var key = hook.dataset[NS + "Hook" + capitalized];
            this._elements[key] = hook;
        }
    };

    Search.prototype._setupProperties = function(options) {
        this._properties = {};

        for (var key in properties) {
            if (properties.hasOwnProperty(key)) {
                var property = properties[key];
                if (options && options[key] != null) {
                    if (property && typeof property.transform === "function") {
                        this._properties[key] = property.transform(options[key]);
                    } else {
                        this._properties[key] = options[key];
                    }
                } else {
                    this._properties[key] = properties[key]["default"];
                }
            }
        }
    };

    function onDocumentReady() {
        var elements = document.querySelectorAll(selectors.self);
        for (var i = 0; i < elements.length; i++) {
            new Search({ element: elements[i], options: readData(elements[i]) });
        }

        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        var body = document.querySelector("body");
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // needed for IE
                var nodesArray = [].slice.call(mutation.addedNodes);
                if (nodesArray.length > 0) {
                    nodesArray.forEach(function(addedNode) {
                        if (addedNode.querySelectorAll) {
                            var elementsArray = [].slice.call(addedNode.querySelectorAll(selectors.self));
                            elementsArray.forEach(function(element) {
                                new Search({ element: element, options: readData(element) });
                            });
                        }
                    });
                }
            });
        });

        observer.observe(body, {
            subtree: true,
            childList: true,
            characterData: true
        });
    }

    if (document.readyState !== "loading") {
        onDocumentReady();
    } else {
        document.addEventListener("DOMContentLoaded", onDocumentReady);
    }

})();

/*******************************************************************************
 * Copyright 2016 Adobe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
(function() {
    "use strict";

    var NS = "cmp";
    var IS = "formText";
    var IS_DASH = "form-text";

    var selectors = {
        self: "[data-" + NS + '-is="' + IS + '"]'
    };

    var properties = {
        /**
         * A validation message to display if there is a type mismatch between the user input and expected input.
         *
         * @type {String}
         */
        constraintMessage: {
        },
        /**
         * A validation message to display if no input is supplied, but input is expected for the field.
         *
         * @type {String}
         */
        requiredMessage: {
        }
    };

    function readData(element) {
        var data = element.dataset;
        var options = [];
        var capitalized = IS;
        capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
        var reserved = ["is", "hook" + capitalized];

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var value = data[key];

                if (key.indexOf(NS) === 0) {
                    key = key.slice(NS.length);
                    key = key.charAt(0).toLowerCase() + key.substring(1);

                    if (reserved.indexOf(key) === -1) {
                        options[key] = value;
                    }
                }
            }
        }

        return options;
    }

    function FormText(config) {
        if (config.element) {
            // prevents multiple initialization
            config.element.removeAttribute("data-" + NS + "-is");
        }

        this._cacheElements(config.element);
        this._setupProperties(config.options);

        this._elements.input.addEventListener("invalid", this._onInvalid.bind(this));
        this._elements.input.addEventListener("input", this._onInput.bind(this));
    }

    FormText.prototype._onInvalid = function(event) {
        event.target.setCustomValidity("");
        if (event.target.validity.typeMismatch) {
            if (this._properties.constraintMessage) {
                event.target.setCustomValidity(this._properties.constraintMessage);
            }
        } else if (event.target.validity.valueMissing) {
            if (this._properties.requiredMessage) {
                event.target.setCustomValidity(this._properties.requiredMessage);
            }
        }
    };

    FormText.prototype._onInput = function(event) {
        event.target.setCustomValidity("");
    };

    FormText.prototype._cacheElements = function(wrapper) {
        this._elements = {};
        this._elements.self = wrapper;
        var hooks = this._elements.self.querySelectorAll("[data-" + NS + "-hook-" + IS_DASH + "]");
        for (var i = 0; i < hooks.length; i++) {
            var hook = hooks[i];
            var capitalized = IS;
            capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
            var key = hook.dataset[NS + "Hook" + capitalized];
            this._elements[key] = hook;
        }
    };

    FormText.prototype._setupProperties = function(options) {
        this._properties = {};

        for (var key in properties) {
            if (properties.hasOwnProperty(key)) {
                var property = properties[key];
                if (options && options[key] != null) {
                    if (property && typeof property.transform === "function") {
                        this._properties[key] = property.transform(options[key]);
                    } else {
                        this._properties[key] = options[key];
                    }
                } else {
                    this._properties[key] = properties[key]["default"];
                }
            }
        }
    };

    function onDocumentReady() {
        var elements = document.querySelectorAll(selectors.self);
        for (var i = 0; i < elements.length; i++) {
            new FormText({ element: elements[i], options: readData(elements[i]) });
        }

        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        var body = document.querySelector("body");
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // needed for IE
                var nodesArray = [].slice.call(mutation.addedNodes);
                if (nodesArray.length > 0) {
                    nodesArray.forEach(function(addedNode) {
                        if (addedNode.querySelectorAll) {
                            var elementsArray = [].slice.call(addedNode.querySelectorAll(selectors.self));
                            elementsArray.forEach(function(element) {
                                new FormText({ element: element, options: readData(element) });
                            });
                        }
                    });
                }
            });
        });

        observer.observe(body, {
            subtree: true,
            childList: true,
            characterData: true
        });
    }

    if (document.readyState !== "loading") {
        onDocumentReady();
    } else {
        document.addEventListener("DOMContentLoaded", onDocumentReady);
    }

})();

$(document).ready(function(){
	$('.form-component').each(function ( ) {
		var $this = $(this);
		var flexClass = '-flex-1';

		switch($this.attr('data-form-flex')){
			case "2":
				flexClass = '-flex-2';
				break;
			case "3":
				flexClass = '-flex-3';
				break;
			case "4":
				flexClass = '-flex-4';
				break;
			case "5":
				flexClass = '-flex-5';
				break;
		}

		$this.parent().addClass(flexClass);
	});
});
$( document ).ready( function () {
	var $formComponents = $( '.form-container.component' );

	$formComponents.each( function () {
		var formComponent = this;
		var $formComponent = $( this );
		var $nextButton = $formComponent.find( '.next-button' );

		$nextButton.on( 'click', function ( e ) {
			if ( formComponent.checkValidity() ) {
				var $formModalBackground = $formComponent.find( '.modal-background' );
				var $formSubmitModal = $formComponent.find( '.submit-modal' );

				var closeModal = function () {
					$formSubmitModal.removeClass( '-open' );
					$formModalBackground.hide();
				};
				$formModalBackground.on( 'click', closeModal );

				$formSubmitModal.addClass( '-open' );
				$formModalBackground.show();
			} else {
				//click submit button to trigger browser error functionality
				$formComponent.find( ':submit' ).click();
			}
		} );
	} );
} );
$( document ).ready( function () {
	var $orphanError = $( '.orphan-error' );
	var $orphanIdList = $( '.orphan-ids-list' );
	var $orphanPathSelect = $('.orphan-path-select');

	$orphanPathSelect.on( 'change', function ( event ) {
		$orphanIdList.html( '' );
		$orphanError.html( '' );
		if ( event.target.value !== 'unset' ) {
			getOrphans( event.target.value );
			$( this ).attr( 'disabled', true );
		} else {
			$orphanError.html( 'You must select a root path to start from.' );
		}
	} );

	function getOrphans( rootPath ) {
		$.ajax( {
			url: '/bin/content-fragment?findOrphans=' + rootPath,
			method: 'GET',
			success: function ( data ) {
				processData( data );
			},
			error: function ( jpXHR, status, error ) {
				handleError( jpXHR, status, error );
			},
			complete: function () {
				$orphanPathSelect.attr( 'disabled', false );
			}
		} )
	}

	function processData( data ) {
		try {
			var json = JSON.parse( data );
			if ( json.orphans.length == 0 ) {
				$li = $( document.createElement( 'li' ) );
				$li.html( 'No orphan content fragment IDs found.' );
				$orphanIdList.append( $li );
			} else {
				for ( var i = 0; i < json.orphans.length; i++ ) {
					var orphan = json.orphans[ i ];
					var $li = $( document.createElement( 'li' ) );
					$orphanIdList.append( $li );
					$li.addClass( 'orphan-item' );
					var $anchor = $( document.createElement( 'a' ) );
					var $title = $( document.createElement( 'h2' ) );
					$li.append( $title );
					$title.text( orphan.id );
					$anchor.attr( 'href', encodeURI('/editor.html' + orphan.page_path ) + '.html' );
					$anchor.attr( 'alt', escape( 'link to ' + orphan.page_path ) );
					$anchor.attr( 'aria-label', 'edit the page where the orphan content fragment ID is' );
					$anchor.text( 'Edit the page at ' + orphan.page_path );
					$anchor.attr( 'target', '_blank' );
					$li.append( $anchor );
					var $div = $( document.createElement( 'div' ) );
					$li.append( $div );
				}
			}
		} catch ( e ) {
			$orphanPathSelect.attr( 'disabled', false );
			$$orpanError.html( e );
		}
	}

	function handleError( jpXHR, status, error ) {
		$orphanError.html( jpXHR.responseText );
	}
} );

$( document ).ready( function () {
	var fragmentInfo = '            <section class="fragment-info">\n' +
		'                <div class="fragment-information">' +
		'                <span class="fragment-title">fragment title</span>\n' +
		'                <div class="fragment-path">\n' +
		'                    <span class="fragment-path-value">fragment path</span>\n' +
		'                    <div class="cta-button section">\n' +
		'                        <div class="cta-button component -text-width style-a 11">\n' +
		'                            <a class="cta-button-link" aria-label="edit the content fragment" role="button">\n' +
		'                                <span class="button-text">Edit</span>\n' +
		'                            </a>\n' +
		'                        </div>\n' +
		'                    </div>\n' +
		'                </div>\n' +
		'</div>\n' +
		'<div class="fragment-value"></div>' +
		'            </section>';
	var variationContainer = '            <div class="fragment-variations">\n' +
		'                <!-- show available variations -->\n' +
		'                <div class="title section" >\n' +
		'                    <div class="cmp-title title-container">\n' +
		'                        <h3 class="cmp-title__text  -default-theme">\n' +
		'                            Variations\n' +
		'                        </h3>\n' +
		'                    </div>\n' +
		'                </div>\n' +
		'            </div>\n';
	var variationDetail = '            <div class="variation-detail">\n' +
		'                    <span class="variation-title">Title</span><span class="variation-description">Description</span>\n' +
		'                    <div class="fragment-value"></div>\n' +
		'                </div>\n' +
		'            </div>\n';
	var referenceContainer = '            <div class="fragment-references">\n' +
		'                <!-- list of pages that reference the fragment -->\n' +
		'                <div class="title section">\n' +
		'                    <div class="cmp-title title-container">\n' +
		'                        <h3 class="cmp-title__text  -default-theme">\n' +
		'                            Referencing Pages\n' +
		'                        </h3>\n' +
		'                    </div>\n' +
		'                </div>\n' +
		'            </div>\n';
	var referenceDetail = '            <li class="reference-information">\n' +
		'                    <a class="reference-link" href="page-path"></a>\n' +
		'                </li>\n';
	var $fragmentError = $( '.fragment-error' );
	var $fragmentDetail = $( '.fragment-detail' );
	var $waitingForReturn = false;

	$( '.submit-button' ).on( 'click', function () {
		if ( !$waitingForReturn ) {
			getFragmentInfo();
		} else {
			pleaseWait();
		}
	} );

	$( '.find-unreferenced').on( 'click', function(){
		if ( !$waitingForReturn ) {
			getUnreferencedFragments();
		} else {
			pleaseWait();
		}
	});

	$( '.fragment-id' ).on( 'keypress', function ( event ) {
		if ( 13 === event.which ) {
			if ( !$waitingForReturn ) {
				event.preventDefault();
				getFragmentInfo();
			} else {
				pleaseWait();
			}
		}
	} );

	function pleaseWait() {
		$fragmentError.text( 'Please wait for the response. ' );
	}

	function getFragmentInfo() {
		$waitingForReturn = true;
		var $errorElement = $( '.fragment-error' );
		var $fragmentID = $( '.fragment-id' );
		$( '.fragment-root' ).remove();

		$errorElement.html( '' );
		if ( $fragmentID.val() === '' ) {
			$errorElement.html( '<span>The fragment ID may not be empty</span>' );
		} else {
			$.ajax( {
				url: '/bin/content-fragment?fragmentID=' + $fragmentID.val(),
				success: function ( data ) {
					processResponse( data );
				},
				error: function ( jpXHR, status, error ) {
					processError( jpXHR, status, error );
				},
				complete: function () {
					$waitingForReturn = false;
				}
			} );
		}
	}

	function processResponse( data ) {
		$fragmentError.text( '' );
		var element;
		var json;
		try {
			json = JSON.parse( data );
		} catch ( e ) {
			$waitingForReturn = false;
			$fragmentError.text( data );
			return;
		}
		if ( json.error !== undefined ) {
			$fragmentError.text( json.error );
		}
		if ( json.results.length > 0 ) {
			for ( var i = 0; i < json.results.length; i++ ) {
				// build out the fragment detail
				var result = json.results[ i ];
				element = document.createElement( 'div' );
				$( element ).addClass( 'fragment-root' );
				var $element = $( element ).append( fragmentInfo );
				$element.find( '.fragment-title' ).text( result.title );
				$element.find( '.fragment-path-value' ).text( result.path );
				$element.find( '.cta-button-link' ).attr( 'href', encodeURI( '/editor.html' + result.path ) ).attr( 'target', '_blank' );
				$element.find( '.fragment-value' ).html( escape( result.value ) );
				$fragmentDetail.append( $element );
				var $fragmentInfo = $element;

				if ( result.variations.length ) {
					// build the variations
					element = document.createElement( 'section' );
					var $variationContainer = $( element ).append( variationContainer );
					$fragmentInfo.append( $variationContainer );
					// build out the variations
					for ( var j = 0; j < result.variations.length; j++ ) {
						var variation = result.variations[ j ];
						var $newVar = $( document.createElement( 'div' ) );
						$newVar.append( variationDetail );
						$newVar.find( '.variation-title' ).text( variation.title );
						$newVar.find( '.variation-description' ).text( variation.description );
						$newVar.find( '.fragment-value' ).html( escape( variation.value ) );
						$variationContainer.append( $newVar );
					}
				}

				if ( result.references.length > 0 ) {
					// build out the references
					element = document.createElement( 'section' );
					var $referenceContainer = $( element ).append( referenceContainer );

					var $nav = $( document.createElement( 'nav' ) );
					$nav.attr( 'area-label', encodeURI( 'Referencing pages for ' + result.path.replace( /\//gm, ' ' ) ) );
					var $ul = $( document.createElement( 'ul' ) );
					$referenceContainer.append( $nav );
					$nav.append( $ul );

					$fragmentInfo.append( $referenceContainer );
					for ( var k = 0; k < result.references.length; k++ ) {
						var reference = result.references[ k ];
						var $newRef = $ul.append( referenceDetail );
						var $detail = $( $newRef.children()[ k ] ).find( '.reference-link' );
						$detail.text( reference.title ).attr( 'href', encodeURI( '/editor.html' + reference.path ) ).attr( 'target', '_blank' );
					}
				}
			}
		}
	}

	function processError( jpXHR, status, error ) {
		$( '.fragment-error' ).html( escape( jpXHR.responseText ) );
	}

	function getUnreferencedFragments(){
		$waitingForReturn = true;
		$('.unreferenced-fragments').text('');
		$.ajax( {
			url: '/bin/content-fragment',
			success: function ( data ) {
				processUnreferenced( data );
			},
			error: function ( jpXHR, status, error ) {
				processError( jpXHR, status, error );
			},
			complete: function () {
				$waitingForReturn = false;
			}
		} );

	}

	function processUnreferenced( data ){
		var json = JSON.parse( data );
		var $unreferenced = $('.unreferenced-fragments');
		$('.find-unreferenced-fragments .found-count').text( 'Found ' + json.unreferenced.length + 'unreferenced content fragments.')
		for( var i = 0; i < json.unreferenced.length; i++ ){
			var obj = json.unreferenced[i];
			var $fragment = $( document.createElement( 'li' ) );
			var $link = $(document.createElement('a'));
			$unreferenced.append( $fragment );
			$fragment.append( $link );
			$fragment.addClass('reference-information');
			$link.attr( 'href', encodeURI( '/editor.html' + obj.path ) );
			$link.text( obj.title + ' at ' + obj.path );
			$link.attr( 'alt', encodeURI( obj.path ) );
			$link.attr( 'aria-label', encodeURI( 'Link to fragment ' + obj.name ) );
		}
	}
} );

$( document ).ready( function () {
	var $window = $( window );
	var $lpHeaderNavLink = $(".lp-header-nav-item");
	var $headerLink = $lpHeaderNavLink.find( " .lp-header-nav-link" );
	var $body = $( "body" );
	var desktopThreshold = 1024;
	var windowLocationParts = window.location.pathname.split( "/" );
	var baseLocation = windowLocationParts[ 1 ];
	var $lpHeaderNavContainer = $( ".lp-header-nav-container" );
	var linkUnderlinesDisabled = $lpHeaderNavContainer.hasClass( "LinkUnderlinesDisabled" );
	var $headerWrapper = $body.find( ".lp-header-wrapper" );
	var $headerSections = $( ".header-section" );

	var headerLinkActive = function ( $this ) {
		$this.addClass( "-parent-page" );
	};

	$headerLink.each( function () {
		var $this = $( this );
		var href = $this.attr( "href" ).split( "/" );
		var hrefBase = href[ 1 ];

		if ( !linkUnderlinesDisabled ) {
			switch ( baseLocation ) {
				case "":
				case "homepage":
					if ( hrefBase == "personal" ) {
						headerLinkActive( $this );
					}
					break;
				default:
					if ( baseLocation == hrefBase ) {
						headerLinkActive( $this );
					}
			}
		}
	} );

	$body.find( "[role=\"button\"], [role=\"menu\"]" ).on( "keydown", function ( event ) {
		if ( event.which === 32 ) {
			var $eventTarget = $( event.target );
			event.preventDefault();
			var href = $eventTarget.attr( "href" );
			if ( href.startsWith( "#" ) && href !== "#skiptomaincontent" ) {
				$eventTarget.trigger( "click" );
			} else {
				window.location = event.target.href;
			}
		}
	} );

	var adjustHeaderSections = function () {
		var finalArrangement = [];
		$headerSections.each( function ( index, element ) {
			var $element = $( element );
			if ( $window.outerWidth() < desktopThreshold ) {
				var $elAlignmentIndex = parseInt( $element.data( "mobile-section-alignment" ) );
			} else {
				var $elAlignmentIndex = parseInt( $element.data( "section-alignment" ) );
			}
			finalArrangement[ $elAlignmentIndex ] = $element;
		} );
		$headerWrapper.prepend( finalArrangement );
	};

	var processAppendPrependHooks = function () {
		var $appendPrependHookElements = $( ".AppendPrependHook" );
		$appendPrependHookElements.each( function () {
			var $this = $( this );
			var $elementAlignment = $this.data( "append-prepend" );
			var $mobileReverse = $this.data( "append-prepend-mobile-reverse" );
			var $parentElement = $this.parent();

			switch ( $elementAlignment ) {
				case "append":
					if ( $window.outerWidth() < desktopThreshold && $mobileReverse ) {
						$parentElement.prepend( $this );
					} else {
						$parentElement.append( $this );
					}
					break;
				case "prepend":
					if ( $window.outerWidth() < desktopThreshold && $mobileReverse ) {
						$parentElement.append( $this );
					} else {
						$parentElement.prepend( $this );
					}
					break;
			}
		} );
	};
	var placeCtaButton = function () {
		var $linkBucket = $( ".LinkBucket" );
		var $iconBucket = $( ".IconBucket" );
		var $iconCtaWrapper = $( ".IconCtaWrapper" );
		var $ctaJsTarget = $( ".CtaJsTarget" );

		if ( $window.outerWidth() < desktopThreshold ) {
			var ctaPlacement = $ctaJsTarget.data( "mobile-placement" );
		} else {
			var ctaPlacement = $ctaJsTarget.data( "desktop-placement" );
		}

		$iconCtaWrapper.removeClass( "-mobile-hidden -desktop-hidden -disabled" );
		$ctaJsTarget.removeClass( "-mobile-hidden -desktop-hidden -disabled" );

		switch ( ctaPlacement ) {
			case "IconLeft":
				$iconCtaWrapper.append( $ctaJsTarget );
				$iconBucket.prepend( $iconCtaWrapper );
				break;
			case "IconRight":
				$iconCtaWrapper.append( $ctaJsTarget );
				$iconBucket.append( $iconCtaWrapper );
				break;
			case "LinksLeft":
				$linkBucket.prepend( $ctaJsTarget );
				$iconCtaWrapper.addClass( "-disabled" );
				break;
			case "LinksRight":
				$linkBucket.append( $ctaJsTarget );
				$iconCtaWrapper.addClass( "-disabled" );
				break;
			case "-mobile-hidden":
				$iconCtaWrapper.addClass( "-mobile-hidden" );
				$ctaJsTarget.addClass( "-mobile-hidden" );
				break;
			case "-desktop-hidden":
				$iconCtaWrapper.addClass( "-desktop-hidden" );
				$ctaJsTarget.addClass( "-desktop-hidden" );
				break;
		}
	};

	adjustHeaderSections();
	processAppendPrependHooks();
	placeCtaButton();

	$window.on( "resize load", function () {
		adjustHeaderSections();
		processAppendPrependHooks();
		placeCtaButton();
	} );
} );

$( document ).ready( function () {
	var $window = $( window );
	var $headerLink = $( '.header-nav-item' ).find( ' .header-link' );
	var $body = $( 'body' );
	var $icons = $('.header-misc-item >.header-link');

	var headerLinkActive = function( $this ) {
		$this.addClass( '-parent-page' );
	}

	$headerLink.each( function () {
		var $this = $( this );
		var windowLocationParts = window.location.pathname.split('/');
		var baseLocation = windowLocationParts[1];
		var href = $this.attr( 'href' ).split('/');
		var hrefBase = href[1];
		switch (baseLocation) {
			case '':
			case 'homepage':
				if ( hrefBase == 'personal' ) {
					headerLinkActive( $this );
				}
				break;
			default:
				if ( baseLocation == hrefBase ) {
					headerLinkActive( $this );
				}
		}
	} );

	$body.find( '[role="button"], [role="menu"]' ).on( 'keydown', function ( event ) {
		if ( event.which === 32 ) {
			var $eventTarget = $( event.target );
			event.preventDefault();
			var href = $eventTarget.attr( 'href' );
			if ( href.startsWith( '#' ) && href !== '#skiptomaincontent') {
				$eventTarget.trigger( 'click' );
			} else {
				window.location = event.target.href;
			}
		}
	} );

	var adjustHeader = function() {
		var _headerWrapper = $body.find( '.header-wrapper' );
		var _hamburgerButton = _headerWrapper.find( '.hamburger-button' );
		var _searchButton = _headerWrapper.find( '.search-button' );
		var _elementsToMove = [ _hamburgerButton, _searchButton ];

		if( $window.width() < 1024 ) {
			_headerWrapper.prepend( _elementsToMove );
		} else {
			_headerWrapper.append( _elementsToMove );
		}
	};

	if( $window.width() < 1024 ) {
		adjustHeader();
	}

	$window.on( 'resize load', function() {
		adjustHeader();
	} );
} );

( function( $ ) {
	var $window = $( window );
	var $footerSocialIcons = $( '.footer-social-icons' );

	$window.on( 'resize load', function() {
		if( $window.width() < 768 ) {
			var socialIcons = $footerSocialIcons.detach();
			$( '.footer-column.-contact-us' ).append( socialIcons );
		} else {
			var socialIcons = $footerSocialIcons.detach();
			$( '.footer-column.-search' ).append( socialIcons );
		}
	} );
} )( this.jQuery );
/*global
	$, jQuery, Utils, Cookies
 */
$( document ).ready( function () {
	'use strict';
	var $zipCodeCapture = $( '.zip-code-capture.component' );
	$zipCodeCapture.each( function () {
		var $this = $( this );
		var $activeZipCode = $this.find( '.active-zip-code' );
		var $zipCodeButton = $this.find( '.zip-button' );
		var $changeButton = $this.find( '.change-zip' );
		var $zipInputField = $this.find( '.zip-input' );
		var $zipInputLabel = $this.find( '.zip-input-label' );
		var $zipErrorMessage = $this.find( '.zip-error-message' );
		var $zipCode = $this.find('.zip-code');
		
		if ( Cookies.get( 'GeoZipCode' ) ) {
			var zipCode = Cookies.get( 'GeoZipCode' );
			$zipCode.html( zipCode );
			$activeZipCode.toggleClass( '-active' );
			Utils.fn.updateNAOLinks(zipCode);
		}
		
		var doChange = function () {
			$zipInputField.val( '' );
			$activeZipCode.toggleClass( '-active' );
			$zipInputField.first().focus();
		};
		
		// change zip code click
		$changeButton.on( 'click', function ( e ) {
			doChange();
			return false;
		} );
		
		$changeButton.on('keyup', function (e) {
			if (e.which === 13) {
				doChange();
			}
			return false;
		});

		// captures zip code
		$zipCodeButton.on( 'mouseup', function ( e ) {
			submitZipCapture();
			return false;
		});
		$zipCodeButton.on( 'keyup', function ( e ) {
			if (e.which === 13) {
				submitZipCapture();
				return false;
			}
		});
		// captures zip code
		$zipInputField.on( 'keyup', function ( e ) {
			if ( e.which !== 9 ) {
				$( this ).siblings( '.zip-error-message' ).removeClass( '-error' );
				$( this ).removeClass( '-error' );
			}
			if ( e.which === 13 ) {
				e.preventDefault();
				submitZipCapture();
			}
		} );
		$zipInputField.on( 'keydown', function ( e ) {
			if ( e.which === 13 ) {
				e.preventDefault();
			}
		} );

		// animate label on focus and blur
		$zipInputField.on( 'focus', function () {
			$zipInputLabel.addClass( '-to-top' );
			$( this ).siblings( '.zip-error-message' ).removeClass( '-error' );
		} );
		$zipInputField.on( 'blur', function () {
			if ( $zipInputField.val().length === 0 ) {
				$zipInputLabel.removeClass( '-to-top' );
			}
		} );

		Utils.inputFilter.onlyAllowDigits($zipInputField);

		var submitZipCapture = function () {
			var zipCode = $zipInputField.val();
			var zipRegex = /(^\d{5}$)/;
			$zipErrorMessage.removeClass( '-error' );
			$zipInputField.removeClass( '-error' );
			if ( zipCode.length > 0 && zipRegex.test( zipCode ) ) {
				$zipInputField.val( '' );
				$zipErrorMessage.removeClass( '-error' );
				$zipInputField.removeClass( '-error' );
				$zipInputField.find( '.zip-code' ).html( zipCode );
				$activeZipCode.toggleClass( '-active' );
				$( '.active-zip-code.-active' ).find( '.change-zip' ).focus();
				setZipCookies( zipCode );
			} else {
				$zipErrorMessage.addClass( '-error' );
				$zipInputField.addClass( '-error' );
			}
		};

		var setZipCookies = function ( zipCode ) {
			try {
				var dynamicQuery = "<View><Query><Where>";
				dynamicQuery += "<And><Eq><FieldRef Name='Title' /><Value Type='Text'>" + zipCode + "</Value></Eq>";
				dynamicQuery += "<Eq><FieldRef Name='ActiveFlag' /><Value Type='Text'>true</Value></Eq></And>";
				dynamicQuery += "</Where></Query><ViewFields><FieldRef Name='GeoZipCodeRegion'/><FieldRef Name='Title'/></ViewFields></View>";
				
				var georegion = "Virtual";
				var sbpdataIn = '{ "siteUrl":"https://authoring.mtb.com", "listQry":"' + dynamicQuery + '","listName": "Geo Zip Code (Published)", "columsList":"Title$GeoZipCodeRegionColChoice$" }';
				jQuery.support.cors = true;
				$.ajax({
					url: "https://apps.mtb.com/web-services/GetListData.svc/ReadListData",
					type: "POST",
					contentType: "application/json; charset=utf-8",
					data: sbpdataIn,
					dataType: "json",
					async: true,
					crossDomain: true,
					cache: false,
					success: function (data) {
						var georegionContent = (data.d != undefined) ? $.parseJSON(data.d) : $.parseJSON(data);
						if ((georegionContent != null) || (georegionContent != "")) {
							if (georegionContent.length === 1) {
								georegion = (georegionContent[0].indexOf(zipCode) != -1) ? georegionContent[0].split('#MTBROW#')[1].replace('#MTBMLOOKUP#', '').split("#MTBCOL#")[1] : georegionContent[1].split('#MTBROW#')[1].replace('#MTBMLOOKUP#', '').split("#MTBCOL#")[1];
							}
							else {
								//API Returned no results. Set to virtual region.
								georegion = "Virtual";
							}
						}
						var baseDomain = $( ".zip-code-input-container" ).data( "runmode" );
						Utils.fn.updateNAOLinks(zipCode);
						Utils.cookies.setCookie('GeoZipCode',zipCode,baseDomain, '/', 999, false );
						// do not encode GeoRegion cookie, it will break the analytics
						Utils.cookies.setCookie('GeoRegion', georegion, baseDomain, '/', 999, false);
						$zipCode.html(zipCode);
						Utils.customEvents.rates.triggerFetchRatesEvent();
					},
					error: function (xhr, status, error) {
						console.error(error);
					}
				});
			}
			catch (e) {
				console.error(e);
			}
		};
	} );
} );

/*!
   Copyright 2008-2019 SpryMedia Ltd.

 This source file is free software, available under the following license:
   MIT license - http://datatables.net/license

 This source file is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 or FITNESS FOR A PARTICULAR PURPOSE. See the license files for details.

 For details please refer to: http://www.datatables.net
 DataTables 1.10.20
 ©2008-2019 SpryMedia Ltd - datatables.net/license
*/
var $jscomp=$jscomp||{};$jscomp.scope={};$jscomp.findInternal=function(f,z,y){f instanceof String&&(f=String(f));for(var p=f.length,H=0;H<p;H++){var L=f[H];if(z.call(y,L,H,f))return{i:H,v:L}}return{i:-1,v:void 0}};$jscomp.ASSUME_ES5=!1;$jscomp.ASSUME_NO_NATIVE_MAP=!1;$jscomp.ASSUME_NO_NATIVE_SET=!1;$jscomp.SIMPLE_FROUND_POLYFILL=!1;
$jscomp.defineProperty=$jscomp.ASSUME_ES5||"function"==typeof Object.defineProperties?Object.defineProperty:function(f,z,y){f!=Array.prototype&&f!=Object.prototype&&(f[z]=y.value)};$jscomp.getGlobal=function(f){return"undefined"!=typeof window&&window===f?f:"undefined"!=typeof global&&null!=global?global:f};$jscomp.global=$jscomp.getGlobal(this);
$jscomp.polyfill=function(f,z,y,p){if(z){y=$jscomp.global;f=f.split(".");for(p=0;p<f.length-1;p++){var H=f[p];H in y||(y[H]={});y=y[H]}f=f[f.length-1];p=y[f];z=z(p);z!=p&&null!=z&&$jscomp.defineProperty(y,f,{configurable:!0,writable:!0,value:z})}};$jscomp.polyfill("Array.prototype.find",function(f){return f?f:function(f,y){return $jscomp.findInternal(this,f,y).v}},"es6","es3");
(function(f){"function"===typeof define&&define.amd?define(["jquery"],function(z){return f(z,window,document)}):"object"===typeof exports?module.exports=function(z,y){z||(z=window);y||(y="undefined"!==typeof window?require("jquery"):require("jquery")(z));return f(y,z,z.document)}:f(jQuery,window,document)})(function(f,z,y,p){function H(a){var b,c,d={};f.each(a,function(e,h){(b=e.match(/^([^A-Z]+?)([A-Z])/))&&-1!=="a aa ai ao as b fn i m o s ".indexOf(b[1]+" ")&&(c=e.replace(b[0],b[2].toLowerCase()),
d[c]=e,"o"===b[1]&&H(a[e]))});a._hungarianMap=d}function L(a,b,c){a._hungarianMap||H(a);var d;f.each(b,function(e,h){d=a._hungarianMap[e];d===p||!c&&b[d]!==p||("o"===d.charAt(0)?(b[d]||(b[d]={}),f.extend(!0,b[d],b[e]),L(a[d],b[d],c)):b[d]=b[e])})}function Ga(a){var b=q.defaults.oLanguage,c=b.sDecimal;c&&Ha(c);if(a){var d=a.sZeroRecords;!a.sEmptyTable&&d&&"No data available in table"===b.sEmptyTable&&M(a,a,"sZeroRecords","sEmptyTable");!a.sLoadingRecords&&d&&"Loading..."===b.sLoadingRecords&&M(a,a,
"sZeroRecords","sLoadingRecords");a.sInfoThousands&&(a.sThousands=a.sInfoThousands);(a=a.sDecimal)&&c!==a&&Ha(a)}}function jb(a){F(a,"ordering","bSort");F(a,"orderMulti","bSortMulti");F(a,"orderClasses","bSortClasses");F(a,"orderCellsTop","bSortCellsTop");F(a,"order","aaSorting");F(a,"orderFixed","aaSortingFixed");F(a,"paging","bPaginate");F(a,"pagingType","sPaginationType");F(a,"pageLength","iDisplayLength");F(a,"searching","bFilter");"boolean"===typeof a.sScrollX&&(a.sScrollX=a.sScrollX?"100%":
"");"boolean"===typeof a.scrollX&&(a.scrollX=a.scrollX?"100%":"");if(a=a.aoSearchCols)for(var b=0,c=a.length;b<c;b++)a[b]&&L(q.models.oSearch,a[b])}function kb(a){F(a,"orderable","bSortable");F(a,"orderData","aDataSort");F(a,"orderSequence","asSorting");F(a,"orderDataType","sortDataType");var b=a.aDataSort;"number"!==typeof b||f.isArray(b)||(a.aDataSort=[b])}function lb(a){if(!q.__browser){var b={};q.__browser=b;var c=f("<div/>").css({position:"fixed",top:0,left:-1*f(z).scrollLeft(),height:1,width:1,
overflow:"hidden"}).append(f("<div/>").css({position:"absolute",top:1,left:1,width:100,overflow:"scroll"}).append(f("<div/>").css({width:"100%",height:10}))).appendTo("body"),d=c.children(),e=d.children();b.barWidth=d[0].offsetWidth-d[0].clientWidth;b.bScrollOversize=100===e[0].offsetWidth&&100!==d[0].clientWidth;b.bScrollbarLeft=1!==Math.round(e.offset().left);b.bBounding=c[0].getBoundingClientRect().width?!0:!1;c.remove()}f.extend(a.oBrowser,q.__browser);a.oScroll.iBarWidth=q.__browser.barWidth}
function mb(a,b,c,d,e,h){var g=!1;if(c!==p){var k=c;g=!0}for(;d!==e;)a.hasOwnProperty(d)&&(k=g?b(k,a[d],d,a):a[d],g=!0,d+=h);return k}function Ia(a,b){var c=q.defaults.column,d=a.aoColumns.length;c=f.extend({},q.models.oColumn,c,{nTh:b?b:y.createElement("th"),sTitle:c.sTitle?c.sTitle:b?b.innerHTML:"",aDataSort:c.aDataSort?c.aDataSort:[d],mData:c.mData?c.mData:d,idx:d});a.aoColumns.push(c);c=a.aoPreSearchCols;c[d]=f.extend({},q.models.oSearch,c[d]);ma(a,d,f(b).data())}function ma(a,b,c){b=a.aoColumns[b];
var d=a.oClasses,e=f(b.nTh);if(!b.sWidthOrig){b.sWidthOrig=e.attr("width")||null;var h=(e.attr("style")||"").match(/width:\s*(\d+[pxem%]+)/);h&&(b.sWidthOrig=h[1])}c!==p&&null!==c&&(kb(c),L(q.defaults.column,c,!0),c.mDataProp===p||c.mData||(c.mData=c.mDataProp),c.sType&&(b._sManualType=c.sType),c.className&&!c.sClass&&(c.sClass=c.className),c.sClass&&e.addClass(c.sClass),f.extend(b,c),M(b,c,"sWidth","sWidthOrig"),c.iDataSort!==p&&(b.aDataSort=[c.iDataSort]),M(b,c,"aDataSort"));var g=b.mData,k=U(g),
l=b.mRender?U(b.mRender):null;c=function(a){return"string"===typeof a&&-1!==a.indexOf("@")};b._bAttrSrc=f.isPlainObject(g)&&(c(g.sort)||c(g.type)||c(g.filter));b._setter=null;b.fnGetData=function(a,b,c){var d=k(a,b,p,c);return l&&b?l(d,b,a,c):d};b.fnSetData=function(a,b,c){return Q(g)(a,b,c)};"number"!==typeof g&&(a._rowReadObject=!0);a.oFeatures.bSort||(b.bSortable=!1,e.addClass(d.sSortableNone));a=-1!==f.inArray("asc",b.asSorting);c=-1!==f.inArray("desc",b.asSorting);b.bSortable&&(a||c)?a&&!c?(b.sSortingClass=
d.sSortableAsc,b.sSortingClassJUI=d.sSortJUIAscAllowed):!a&&c?(b.sSortingClass=d.sSortableDesc,b.sSortingClassJUI=d.sSortJUIDescAllowed):(b.sSortingClass=d.sSortable,b.sSortingClassJUI=d.sSortJUI):(b.sSortingClass=d.sSortableNone,b.sSortingClassJUI="")}function aa(a){if(!1!==a.oFeatures.bAutoWidth){var b=a.aoColumns;Ja(a);for(var c=0,d=b.length;c<d;c++)b[c].nTh.style.width=b[c].sWidth}b=a.oScroll;""===b.sY&&""===b.sX||na(a);A(a,null,"column-sizing",[a])}function ba(a,b){a=oa(a,"bVisible");return"number"===
typeof a[b]?a[b]:null}function ca(a,b){a=oa(a,"bVisible");b=f.inArray(b,a);return-1!==b?b:null}function W(a){var b=0;f.each(a.aoColumns,function(a,d){d.bVisible&&"none"!==f(d.nTh).css("display")&&b++});return b}function oa(a,b){var c=[];f.map(a.aoColumns,function(a,e){a[b]&&c.push(e)});return c}function Ka(a){var b=a.aoColumns,c=a.aoData,d=q.ext.type.detect,e,h,g;var k=0;for(e=b.length;k<e;k++){var f=b[k];var n=[];if(!f.sType&&f._sManualType)f.sType=f._sManualType;else if(!f.sType){var m=0;for(h=
d.length;m<h;m++){var w=0;for(g=c.length;w<g;w++){n[w]===p&&(n[w]=I(a,w,k,"type"));var u=d[m](n[w],a);if(!u&&m!==d.length-1)break;if("html"===u)break}if(u){f.sType=u;break}}f.sType||(f.sType="string")}}}function nb(a,b,c,d){var e,h,g,k=a.aoColumns;if(b)for(e=b.length-1;0<=e;e--){var l=b[e];var n=l.targets!==p?l.targets:l.aTargets;f.isArray(n)||(n=[n]);var m=0;for(h=n.length;m<h;m++)if("number"===typeof n[m]&&0<=n[m]){for(;k.length<=n[m];)Ia(a);d(n[m],l)}else if("number"===typeof n[m]&&0>n[m])d(k.length+
n[m],l);else if("string"===typeof n[m]){var w=0;for(g=k.length;w<g;w++)("_all"==n[m]||f(k[w].nTh).hasClass(n[m]))&&d(w,l)}}if(c)for(e=0,a=c.length;e<a;e++)d(e,c[e])}function R(a,b,c,d){var e=a.aoData.length,h=f.extend(!0,{},q.models.oRow,{src:c?"dom":"data",idx:e});h._aData=b;a.aoData.push(h);for(var g=a.aoColumns,k=0,l=g.length;k<l;k++)g[k].sType=null;a.aiDisplayMaster.push(e);b=a.rowIdFn(b);b!==p&&(a.aIds[b]=h);!c&&a.oFeatures.bDeferRender||La(a,e,c,d);return e}function pa(a,b){var c;b instanceof
f||(b=f(b));return b.map(function(b,e){c=Ma(a,e);return R(a,c.data,e,c.cells)})}function I(a,b,c,d){var e=a.iDraw,h=a.aoColumns[c],g=a.aoData[b]._aData,k=h.sDefaultContent,f=h.fnGetData(g,d,{settings:a,row:b,col:c});if(f===p)return a.iDrawError!=e&&null===k&&(O(a,0,"Requested unknown parameter "+("function"==typeof h.mData?"{function}":"'"+h.mData+"'")+" for row "+b+", column "+c,4),a.iDrawError=e),k;if((f===g||null===f)&&null!==k&&d!==p)f=k;else if("function"===typeof f)return f.call(g);return null===
f&&"display"==d?"":f}function ob(a,b,c,d){a.aoColumns[c].fnSetData(a.aoData[b]._aData,d,{settings:a,row:b,col:c})}function Na(a){return f.map(a.match(/(\\.|[^\.])+/g)||[""],function(a){return a.replace(/\\\./g,".")})}function U(a){if(f.isPlainObject(a)){var b={};f.each(a,function(a,c){c&&(b[a]=U(c))});return function(a,c,h,g){var d=b[c]||b._;return d!==p?d(a,c,h,g):a}}if(null===a)return function(a){return a};if("function"===typeof a)return function(b,c,h,g){return a(b,c,h,g)};if("string"!==typeof a||
-1===a.indexOf(".")&&-1===a.indexOf("[")&&-1===a.indexOf("("))return function(b,c){return b[a]};var c=function(a,b,h){if(""!==h){var d=Na(h);for(var e=0,l=d.length;e<l;e++){h=d[e].match(da);var n=d[e].match(X);if(h){d[e]=d[e].replace(da,"");""!==d[e]&&(a=a[d[e]]);n=[];d.splice(0,e+1);d=d.join(".");if(f.isArray(a))for(e=0,l=a.length;e<l;e++)n.push(c(a[e],b,d));a=h[0].substring(1,h[0].length-1);a=""===a?n:n.join(a);break}else if(n){d[e]=d[e].replace(X,"");a=a[d[e]]();continue}if(null===a||a[d[e]]===
p)return p;a=a[d[e]]}}return a};return function(b,e){return c(b,e,a)}}function Q(a){if(f.isPlainObject(a))return Q(a._);if(null===a)return function(){};if("function"===typeof a)return function(b,d,e){a(b,"set",d,e)};if("string"!==typeof a||-1===a.indexOf(".")&&-1===a.indexOf("[")&&-1===a.indexOf("("))return function(b,d){b[a]=d};var b=function(a,d,e){e=Na(e);var c=e[e.length-1];for(var g,k,l=0,n=e.length-1;l<n;l++){g=e[l].match(da);k=e[l].match(X);if(g){e[l]=e[l].replace(da,"");a[e[l]]=[];c=e.slice();
c.splice(0,l+1);g=c.join(".");if(f.isArray(d))for(k=0,n=d.length;k<n;k++)c={},b(c,d[k],g),a[e[l]].push(c);else a[e[l]]=d;return}k&&(e[l]=e[l].replace(X,""),a=a[e[l]](d));if(null===a[e[l]]||a[e[l]]===p)a[e[l]]={};a=a[e[l]]}if(c.match(X))a[c.replace(X,"")](d);else a[c.replace(da,"")]=d};return function(c,d){return b(c,d,a)}}function Oa(a){return J(a.aoData,"_aData")}function qa(a){a.aoData.length=0;a.aiDisplayMaster.length=0;a.aiDisplay.length=0;a.aIds={}}function ra(a,b,c){for(var d=-1,e=0,h=a.length;e<
h;e++)a[e]==b?d=e:a[e]>b&&a[e]--; -1!=d&&c===p&&a.splice(d,1)}function ea(a,b,c,d){var e=a.aoData[b],h,g=function(c,d){for(;c.childNodes.length;)c.removeChild(c.firstChild);c.innerHTML=I(a,b,d,"display")};if("dom"!==c&&(c&&"auto"!==c||"dom"!==e.src)){var k=e.anCells;if(k)if(d!==p)g(k[d],d);else for(c=0,h=k.length;c<h;c++)g(k[c],c)}else e._aData=Ma(a,e,d,d===p?p:e._aData).data;e._aSortData=null;e._aFilterData=null;g=a.aoColumns;if(d!==p)g[d].sType=null;else{c=0;for(h=g.length;c<h;c++)g[c].sType=null;
Pa(a,e)}}function Ma(a,b,c,d){var e=[],h=b.firstChild,g,k=0,l,n=a.aoColumns,m=a._rowReadObject;d=d!==p?d:m?{}:[];var w=function(a,b){if("string"===typeof a){var c=a.indexOf("@");-1!==c&&(c=a.substring(c+1),Q(a)(d,b.getAttribute(c)))}},u=function(a){if(c===p||c===k)g=n[k],l=f.trim(a.innerHTML),g&&g._bAttrSrc?(Q(g.mData._)(d,l),w(g.mData.sort,a),w(g.mData.type,a),w(g.mData.filter,a)):m?(g._setter||(g._setter=Q(g.mData)),g._setter(d,l)):d[k]=l;k++};if(h)for(;h;){var q=h.nodeName.toUpperCase();if("TD"==
q||"TH"==q)u(h),e.push(h);h=h.nextSibling}else for(e=b.anCells,h=0,q=e.length;h<q;h++)u(e[h]);(b=b.firstChild?b:b.nTr)&&(b=b.getAttribute("id"))&&Q(a.rowId)(d,b);return{data:d,cells:e}}function La(a,b,c,d){var e=a.aoData[b],h=e._aData,g=[],k,l;if(null===e.nTr){var n=c||y.createElement("tr");e.nTr=n;e.anCells=g;n._DT_RowIndex=b;Pa(a,e);var m=0;for(k=a.aoColumns.length;m<k;m++){var w=a.aoColumns[m];var p=(l=c?!1:!0)?y.createElement(w.sCellType):d[m];p._DT_CellIndex={row:b,column:m};g.push(p);if(l||
!(c&&!w.mRender&&w.mData===m||f.isPlainObject(w.mData)&&w.mData._===m+".display"))p.innerHTML=I(a,b,m,"display");w.sClass&&(p.className+=" "+w.sClass);w.bVisible&&!c?n.appendChild(p):!w.bVisible&&c&&p.parentNode.removeChild(p);w.fnCreatedCell&&w.fnCreatedCell.call(a.oInstance,p,I(a,b,m),h,b,m)}A(a,"aoRowCreatedCallback",null,[n,h,b,g])}e.nTr.setAttribute("role","row")}function Pa(a,b){var c=b.nTr,d=b._aData;if(c){if(a=a.rowIdFn(d))c.id=a;d.DT_RowClass&&(a=d.DT_RowClass.split(" "),b.__rowc=b.__rowc?
ta(b.__rowc.concat(a)):a,f(c).removeClass(b.__rowc.join(" ")).addClass(d.DT_RowClass));d.DT_RowAttr&&f(c).attr(d.DT_RowAttr);d.DT_RowData&&f(c).data(d.DT_RowData)}}function pb(a){var b,c,d=a.nTHead,e=a.nTFoot,h=0===f("th, td",d).length,g=a.oClasses,k=a.aoColumns;h&&(c=f("<tr/>").appendTo(d));var l=0;for(b=k.length;l<b;l++){var n=k[l];var m=f(n.nTh).addClass(n.sClass);h&&m.appendTo(c);a.oFeatures.bSort&&(m.addClass(n.sSortingClass),!1!==n.bSortable&&(m.attr("tabindex",a.iTabIndex).attr("aria-controls",
a.sTableId),Qa(a,n.nTh,l)));n.sTitle!=m[0].innerHTML&&m.html(n.sTitle);Ra(a,"header")(a,m,n,g)}h&&fa(a.aoHeader,d);f(d).find(">tr").attr("role","row");f(d).find(">tr>th, >tr>td").addClass(g.sHeaderTH);f(e).find(">tr>th, >tr>td").addClass(g.sFooterTH);if(null!==e)for(a=a.aoFooter[0],l=0,b=a.length;l<b;l++)n=k[l],n.nTf=a[l].cell,n.sClass&&f(n.nTf).addClass(n.sClass)}function ha(a,b,c){var d,e,h=[],g=[],k=a.aoColumns.length;if(b){c===p&&(c=!1);var l=0;for(d=b.length;l<d;l++){h[l]=b[l].slice();h[l].nTr=
b[l].nTr;for(e=k-1;0<=e;e--)a.aoColumns[e].bVisible||c||h[l].splice(e,1);g.push([])}l=0;for(d=h.length;l<d;l++){if(a=h[l].nTr)for(;e=a.firstChild;)a.removeChild(e);e=0;for(b=h[l].length;e<b;e++){var n=k=1;if(g[l][e]===p){a.appendChild(h[l][e].cell);for(g[l][e]=1;h[l+k]!==p&&h[l][e].cell==h[l+k][e].cell;)g[l+k][e]=1,k++;for(;h[l][e+n]!==p&&h[l][e].cell==h[l][e+n].cell;){for(c=0;c<k;c++)g[l+c][e+n]=1;n++}f(h[l][e].cell).attr("rowspan",k).attr("colspan",n)}}}}}function S(a){var b=A(a,"aoPreDrawCallback",
"preDraw",[a]);if(-1!==f.inArray(!1,b))K(a,!1);else{b=[];var c=0,d=a.asStripeClasses,e=d.length,h=a.oLanguage,g=a.iInitDisplayStart,k="ssp"==D(a),l=a.aiDisplay;a.bDrawing=!0;g!==p&&-1!==g&&(a._iDisplayStart=k?g:g>=a.fnRecordsDisplay()?0:g,a.iInitDisplayStart=-1);g=a._iDisplayStart;var n=a.fnDisplayEnd();if(a.bDeferLoading)a.bDeferLoading=!1,a.iDraw++,K(a,!1);else if(!k)a.iDraw++;else if(!a.bDestroying&&!qb(a))return;if(0!==l.length)for(h=k?a.aoData.length:n,k=k?0:g;k<h;k++){var m=l[k],w=a.aoData[m];
null===w.nTr&&La(a,m);var u=w.nTr;if(0!==e){var q=d[c%e];w._sRowStripe!=q&&(f(u).removeClass(w._sRowStripe).addClass(q),w._sRowStripe=q)}A(a,"aoRowCallback",null,[u,w._aData,c,k,m]);b.push(u);c++}else c=h.sZeroRecords,1==a.iDraw&&"ajax"==D(a)?c=h.sLoadingRecords:h.sEmptyTable&&0===a.fnRecordsTotal()&&(c=h.sEmptyTable),b[0]=f("<tr/>",{"class":e?d[0]:""}).append(f("<td />",{valign:"top",colSpan:W(a),"class":a.oClasses.sRowEmpty}).html(c))[0];A(a,"aoHeaderCallback","header",[f(a.nTHead).children("tr")[0],
Oa(a),g,n,l]);A(a,"aoFooterCallback","footer",[f(a.nTFoot).children("tr")[0],Oa(a),g,n,l]);d=f(a.nTBody);d.children().detach();d.append(f(b));A(a,"aoDrawCallback","draw",[a]);a.bSorted=!1;a.bFiltered=!1;a.bDrawing=!1}}function V(a,b){var c=a.oFeatures,d=c.bFilter;c.bSort&&rb(a);d?ia(a,a.oPreviousSearch):a.aiDisplay=a.aiDisplayMaster.slice();!0!==b&&(a._iDisplayStart=0);a._drawHold=b;S(a);a._drawHold=!1}function sb(a){var b=a.oClasses,c=f(a.nTable);c=f("<div/>").insertBefore(c);var d=a.oFeatures,e=
f("<div/>",{id:a.sTableId+"_wrapper","class":b.sWrapper+(a.nTFoot?"":" "+b.sNoFooter)});a.nHolding=c[0];a.nTableWrapper=e[0];a.nTableReinsertBefore=a.nTable.nextSibling;for(var h=a.sDom.split(""),g,k,l,n,m,p,u=0;u<h.length;u++){g=null;k=h[u];if("<"==k){l=f("<div/>")[0];n=h[u+1];if("'"==n||'"'==n){m="";for(p=2;h[u+p]!=n;)m+=h[u+p],p++;"H"==m?m=b.sJUIHeader:"F"==m&&(m=b.sJUIFooter);-1!=m.indexOf(".")?(n=m.split("."),l.id=n[0].substr(1,n[0].length-1),l.className=n[1]):"#"==m.charAt(0)?l.id=m.substr(1,
m.length-1):l.className=m;u+=p}e.append(l);e=f(l)}else if(">"==k)e=e.parent();else if("l"==k&&d.bPaginate&&d.bLengthChange)g=tb(a);else if("f"==k&&d.bFilter)g=ub(a);else if("r"==k&&d.bProcessing)g=vb(a);else if("t"==k)g=wb(a);else if("i"==k&&d.bInfo)g=xb(a);else if("p"==k&&d.bPaginate)g=yb(a);else if(0!==q.ext.feature.length)for(l=q.ext.feature,p=0,n=l.length;p<n;p++)if(k==l[p].cFeature){g=l[p].fnInit(a);break}g&&(l=a.aanFeatures,l[k]||(l[k]=[]),l[k].push(g),e.append(g))}c.replaceWith(e);a.nHolding=
null}function fa(a,b){b=f(b).children("tr");var c,d,e;a.splice(0,a.length);var h=0;for(e=b.length;h<e;h++)a.push([]);h=0;for(e=b.length;h<e;h++){var g=b[h];for(c=g.firstChild;c;){if("TD"==c.nodeName.toUpperCase()||"TH"==c.nodeName.toUpperCase()){var k=1*c.getAttribute("colspan");var l=1*c.getAttribute("rowspan");k=k&&0!==k&&1!==k?k:1;l=l&&0!==l&&1!==l?l:1;var n=0;for(d=a[h];d[n];)n++;var m=n;var p=1===k?!0:!1;for(d=0;d<k;d++)for(n=0;n<l;n++)a[h+n][m+d]={cell:c,unique:p},a[h+n].nTr=g}c=c.nextSibling}}}
function ua(a,b,c){var d=[];c||(c=a.aoHeader,b&&(c=[],fa(c,b)));b=0;for(var e=c.length;b<e;b++)for(var h=0,g=c[b].length;h<g;h++)!c[b][h].unique||d[h]&&a.bSortCellsTop||(d[h]=c[b][h].cell);return d}function va(a,b,c){A(a,"aoServerParams","serverParams",[b]);if(b&&f.isArray(b)){var d={},e=/(.*?)\[\]$/;f.each(b,function(a,b){(a=b.name.match(e))?(a=a[0],d[a]||(d[a]=[]),d[a].push(b.value)):d[b.name]=b.value});b=d}var h=a.ajax,g=a.oInstance,k=function(b){A(a,null,"xhr",[a,b,a.jqXHR]);c(b)};if(f.isPlainObject(h)&&
h.data){var l=h.data;var n="function"===typeof l?l(b,a):l;b="function"===typeof l&&n?n:f.extend(!0,b,n);delete h.data}n={data:b,success:function(b){var c=b.error||b.sError;c&&O(a,0,c);a.json=b;k(b)},dataType:"json",cache:!1,type:a.sServerMethod,error:function(b,c,d){d=A(a,null,"xhr",[a,null,a.jqXHR]);-1===f.inArray(!0,d)&&("parsererror"==c?O(a,0,"Invalid JSON response",1):4===b.readyState&&O(a,0,"Ajax error",7));K(a,!1)}};a.oAjaxData=b;A(a,null,"preXhr",[a,b]);a.fnServerData?a.fnServerData.call(g,
a.sAjaxSource,f.map(b,function(a,b){return{name:b,value:a}}),k,a):a.sAjaxSource||"string"===typeof h?a.jqXHR=f.ajax(f.extend(n,{url:h||a.sAjaxSource})):"function"===typeof h?a.jqXHR=h.call(g,b,k,a):(a.jqXHR=f.ajax(f.extend(n,h)),h.data=l)}function qb(a){return a.bAjaxDataGet?(a.iDraw++,K(a,!0),va(a,zb(a),function(b){Ab(a,b)}),!1):!0}function zb(a){var b=a.aoColumns,c=b.length,d=a.oFeatures,e=a.oPreviousSearch,h=a.aoPreSearchCols,g=[],k=Y(a);var l=a._iDisplayStart;var n=!1!==d.bPaginate?a._iDisplayLength:
-1;var m=function(a,b){g.push({name:a,value:b})};m("sEcho",a.iDraw);m("iColumns",c);m("sColumns",J(b,"sName").join(","));m("iDisplayStart",l);m("iDisplayLength",n);var p={draw:a.iDraw,columns:[],order:[],start:l,length:n,search:{value:e.sSearch,regex:e.bRegex}};for(l=0;l<c;l++){var u=b[l];var sa=h[l];n="function"==typeof u.mData?"function":u.mData;p.columns.push({data:n,name:u.sName,searchable:u.bSearchable,orderable:u.bSortable,search:{value:sa.sSearch,regex:sa.bRegex}});m("mDataProp_"+l,n);d.bFilter&&
(m("sSearch_"+l,sa.sSearch),m("bRegex_"+l,sa.bRegex),m("bSearchable_"+l,u.bSearchable));d.bSort&&m("bSortable_"+l,u.bSortable)}d.bFilter&&(m("sSearch",e.sSearch),m("bRegex",e.bRegex));d.bSort&&(f.each(k,function(a,b){p.order.push({column:b.col,dir:b.dir});m("iSortCol_"+a,b.col);m("sSortDir_"+a,b.dir)}),m("iSortingCols",k.length));b=q.ext.legacy.ajax;return null===b?a.sAjaxSource?g:p:b?g:p}function Ab(a,b){var c=function(a,c){return b[a]!==p?b[a]:b[c]},d=wa(a,b),e=c("sEcho","draw"),h=c("iTotalRecords",
"recordsTotal");c=c("iTotalDisplayRecords","recordsFiltered");if(e){if(1*e<a.iDraw)return;a.iDraw=1*e}qa(a);a._iRecordsTotal=parseInt(h,10);a._iRecordsDisplay=parseInt(c,10);e=0;for(h=d.length;e<h;e++)R(a,d[e]);a.aiDisplay=a.aiDisplayMaster.slice();a.bAjaxDataGet=!1;S(a);a._bInitComplete||xa(a,b);a.bAjaxDataGet=!0;K(a,!1)}function wa(a,b){a=f.isPlainObject(a.ajax)&&a.ajax.dataSrc!==p?a.ajax.dataSrc:a.sAjaxDataProp;return"data"===a?b.aaData||b[a]:""!==a?U(a)(b):b}function ub(a){var b=a.oClasses,c=
a.sTableId,d=a.oLanguage,e=a.oPreviousSearch,h=a.aanFeatures,g='<input type="search" class="'+b.sFilterInput+'"/>',k=d.sSearch;k=k.match(/_INPUT_/)?k.replace("_INPUT_",g):k+g;b=f("<div/>",{id:h.f?null:c+"_filter","class":b.sFilter}).append(f("<label/>").append(k));h=function(){var b=this.value?this.value:"";b!=e.sSearch&&(ia(a,{sSearch:b,bRegex:e.bRegex,bSmart:e.bSmart,bCaseInsensitive:e.bCaseInsensitive}),a._iDisplayStart=0,S(a))};g=null!==a.searchDelay?a.searchDelay:"ssp"===D(a)?400:0;var l=f("input",
b).val(e.sSearch).attr("placeholder",d.sSearchPlaceholder).on("keyup.DT search.DT input.DT paste.DT cut.DT",g?Sa(h,g):h).on("keypress.DT",function(a){if(13==a.keyCode)return!1}).attr("aria-controls",c);f(a.nTable).on("search.dt.DT",function(b,c){if(a===c)try{l[0]!==y.activeElement&&l.val(e.sSearch)}catch(w){}});return b[0]}function ia(a,b,c){var d=a.oPreviousSearch,e=a.aoPreSearchCols,h=function(a){d.sSearch=a.sSearch;d.bRegex=a.bRegex;d.bSmart=a.bSmart;d.bCaseInsensitive=a.bCaseInsensitive},g=function(a){return a.bEscapeRegex!==
p?!a.bEscapeRegex:a.bRegex};Ka(a);if("ssp"!=D(a)){Bb(a,b.sSearch,c,g(b),b.bSmart,b.bCaseInsensitive);h(b);for(b=0;b<e.length;b++)Cb(a,e[b].sSearch,b,g(e[b]),e[b].bSmart,e[b].bCaseInsensitive);Db(a)}else h(b);a.bFiltered=!0;A(a,null,"search",[a])}function Db(a){for(var b=q.ext.search,c=a.aiDisplay,d,e,h=0,g=b.length;h<g;h++){for(var k=[],l=0,n=c.length;l<n;l++)e=c[l],d=a.aoData[e],b[h](a,d._aFilterData,e,d._aData,l)&&k.push(e);c.length=0;f.merge(c,k)}}function Cb(a,b,c,d,e,h){if(""!==b){var g=[],k=
a.aiDisplay;d=Ta(b,d,e,h);for(e=0;e<k.length;e++)b=a.aoData[k[e]]._aFilterData[c],d.test(b)&&g.push(k[e]);a.aiDisplay=g}}function Bb(a,b,c,d,e,h){e=Ta(b,d,e,h);var g=a.oPreviousSearch.sSearch,k=a.aiDisplayMaster;h=[];0!==q.ext.search.length&&(c=!0);var f=Eb(a);if(0>=b.length)a.aiDisplay=k.slice();else{if(f||c||d||g.length>b.length||0!==b.indexOf(g)||a.bSorted)a.aiDisplay=k.slice();b=a.aiDisplay;for(c=0;c<b.length;c++)e.test(a.aoData[b[c]]._sFilterRow)&&h.push(b[c]);a.aiDisplay=h}}function Ta(a,b,
c,d){a=b?a:Ua(a);c&&(a="^(?=.*?"+f.map(a.match(/"[^"]+"|[^ ]+/g)||[""],function(a){if('"'===a.charAt(0)){var b=a.match(/^"(.*)"$/);a=b?b[1]:a}return a.replace('"',"")}).join(")(?=.*?")+").*$");return new RegExp(a,d?"i":"")}function Eb(a){var b=a.aoColumns,c,d,e=q.ext.type.search;var h=!1;var g=0;for(c=a.aoData.length;g<c;g++){var k=a.aoData[g];if(!k._aFilterData){var f=[];var n=0;for(d=b.length;n<d;n++){h=b[n];if(h.bSearchable){var m=I(a,g,n,"filter");e[h.sType]&&(m=e[h.sType](m));null===m&&(m="");
"string"!==typeof m&&m.toString&&(m=m.toString())}else m="";m.indexOf&&-1!==m.indexOf("&")&&(ya.innerHTML=m,m=$b?ya.textContent:ya.innerText);m.replace&&(m=m.replace(/[\r\n\u2028]/g,""));f.push(m)}k._aFilterData=f;k._sFilterRow=f.join("  ");h=!0}}return h}function Fb(a){return{search:a.sSearch,smart:a.bSmart,regex:a.bRegex,caseInsensitive:a.bCaseInsensitive}}function Gb(a){return{sSearch:a.search,bSmart:a.smart,bRegex:a.regex,bCaseInsensitive:a.caseInsensitive}}function xb(a){var b=a.sTableId,c=a.aanFeatures.i,
d=f("<div/>",{"class":a.oClasses.sInfo,id:c?null:b+"_info"});c||(a.aoDrawCallback.push({fn:Hb,sName:"information"}),d.attr("role","status").attr("aria-live","polite"),f(a.nTable).attr("aria-describedby",b+"_info"));return d[0]}function Hb(a){var b=a.aanFeatures.i;if(0!==b.length){var c=a.oLanguage,d=a._iDisplayStart+1,e=a.fnDisplayEnd(),h=a.fnRecordsTotal(),g=a.fnRecordsDisplay(),k=g?c.sInfo:c.sInfoEmpty;g!==h&&(k+=" "+c.sInfoFiltered);k+=c.sInfoPostFix;k=Ib(a,k);c=c.fnInfoCallback;null!==c&&(k=c.call(a.oInstance,
a,d,e,h,g,k));f(b).html(k)}}function Ib(a,b){var c=a.fnFormatNumber,d=a._iDisplayStart+1,e=a._iDisplayLength,h=a.fnRecordsDisplay(),g=-1===e;return b.replace(/_START_/g,c.call(a,d)).replace(/_END_/g,c.call(a,a.fnDisplayEnd())).replace(/_MAX_/g,c.call(a,a.fnRecordsTotal())).replace(/_TOTAL_/g,c.call(a,h)).replace(/_PAGE_/g,c.call(a,g?1:Math.ceil(d/e))).replace(/_PAGES_/g,c.call(a,g?1:Math.ceil(h/e)))}function ja(a){var b=a.iInitDisplayStart,c=a.aoColumns;var d=a.oFeatures;var e=a.bDeferLoading;if(a.bInitialised){sb(a);
pb(a);ha(a,a.aoHeader);ha(a,a.aoFooter);K(a,!0);d.bAutoWidth&&Ja(a);var h=0;for(d=c.length;h<d;h++){var g=c[h];g.sWidth&&(g.nTh.style.width=B(g.sWidth))}A(a,null,"preInit",[a]);V(a);c=D(a);if("ssp"!=c||e)"ajax"==c?va(a,[],function(c){var d=wa(a,c);for(h=0;h<d.length;h++)R(a,d[h]);a.iInitDisplayStart=b;V(a);K(a,!1);xa(a,c)},a):(K(a,!1),xa(a))}else setTimeout(function(){ja(a)},200)}function xa(a,b){a._bInitComplete=!0;(b||a.oInit.aaData)&&aa(a);A(a,null,"plugin-init",[a,b]);A(a,"aoInitComplete","init",
[a,b])}function Va(a,b){b=parseInt(b,10);a._iDisplayLength=b;Wa(a);A(a,null,"length",[a,b])}function tb(a){var b=a.oClasses,c=a.sTableId,d=a.aLengthMenu,e=f.isArray(d[0]),h=e?d[0]:d;d=e?d[1]:d;e=f("<select/>",{name:c+"_length","aria-controls":c,"class":b.sLengthSelect});for(var g=0,k=h.length;g<k;g++)e[0][g]=new Option("number"===typeof d[g]?a.fnFormatNumber(d[g]):d[g],h[g]);var l=f("<div><label/></div>").addClass(b.sLength);a.aanFeatures.l||(l[0].id=c+"_length");l.children().append(a.oLanguage.sLengthMenu.replace("_MENU_",
e[0].outerHTML));f("select",l).val(a._iDisplayLength).on("change.DT",function(b){Va(a,f(this).val());S(a)});f(a.nTable).on("length.dt.DT",function(b,c,d){a===c&&f("select",l).val(d)});return l[0]}function yb(a){var b=a.sPaginationType,c=q.ext.pager[b],d="function"===typeof c,e=function(a){S(a)};b=f("<div/>").addClass(a.oClasses.sPaging+b)[0];var h=a.aanFeatures;d||c.fnInit(a,b,e);h.p||(b.id=a.sTableId+"_paginate",a.aoDrawCallback.push({fn:function(a){if(d){var b=a._iDisplayStart,g=a._iDisplayLength,
f=a.fnRecordsDisplay(),m=-1===g;b=m?0:Math.ceil(b/g);g=m?1:Math.ceil(f/g);f=c(b,g);var p;m=0;for(p=h.p.length;m<p;m++)Ra(a,"pageButton")(a,h.p[m],m,f,b,g)}else c.fnUpdate(a,e)},sName:"pagination"}));return b}function Xa(a,b,c){var d=a._iDisplayStart,e=a._iDisplayLength,h=a.fnRecordsDisplay();0===h||-1===e?d=0:"number"===typeof b?(d=b*e,d>h&&(d=0)):"first"==b?d=0:"previous"==b?(d=0<=e?d-e:0,0>d&&(d=0)):"next"==b?d+e<h&&(d+=e):"last"==b?d=Math.floor((h-1)/e)*e:O(a,0,"Unknown paging action: "+b,5);b=
a._iDisplayStart!==d;a._iDisplayStart=d;b&&(A(a,null,"page",[a]),c&&S(a));return b}function vb(a){return f("<div/>",{id:a.aanFeatures.r?null:a.sTableId+"_processing","class":a.oClasses.sProcessing}).html(a.oLanguage.sProcessing).insertBefore(a.nTable)[0]}function K(a,b){a.oFeatures.bProcessing&&f(a.aanFeatures.r).css("display",b?"block":"none");A(a,null,"processing",[a,b])}function wb(a){var b=f(a.nTable);b.attr("role","grid");var c=a.oScroll;if(""===c.sX&&""===c.sY)return a.nTable;var d=c.sX,e=c.sY,
h=a.oClasses,g=b.children("caption"),k=g.length?g[0]._captionSide:null,l=f(b[0].cloneNode(!1)),n=f(b[0].cloneNode(!1)),m=b.children("tfoot");m.length||(m=null);l=f("<div/>",{"class":h.sScrollWrapper}).append(f("<div/>",{"class":h.sScrollHead}).css({overflow:"hidden",position:"relative",border:0,width:d?d?B(d):null:"100%"}).append(f("<div/>",{"class":h.sScrollHeadInner}).css({"box-sizing":"content-box",width:c.sXInner||"100%"}).append(l.removeAttr("id").css("margin-left",0).append("top"===k?g:null).append(b.children("thead"))))).append(f("<div/>",
{"class":h.sScrollBody}).css({position:"relative",overflow:"auto",width:d?B(d):null}).append(b));m&&l.append(f("<div/>",{"class":h.sScrollFoot}).css({overflow:"hidden",border:0,width:d?d?B(d):null:"100%"}).append(f("<div/>",{"class":h.sScrollFootInner}).append(n.removeAttr("id").css("margin-left",0).append("bottom"===k?g:null).append(b.children("tfoot")))));b=l.children();var p=b[0];h=b[1];var u=m?b[2]:null;if(d)f(h).on("scroll.DT",function(a){a=this.scrollLeft;p.scrollLeft=a;m&&(u.scrollLeft=a)});
f(h).css(e&&c.bCollapse?"max-height":"height",e);a.nScrollHead=p;a.nScrollBody=h;a.nScrollFoot=u;a.aoDrawCallback.push({fn:na,sName:"scrolling"});return l[0]}function na(a){var b=a.oScroll,c=b.sX,d=b.sXInner,e=b.sY;b=b.iBarWidth;var h=f(a.nScrollHead),g=h[0].style,k=h.children("div"),l=k[0].style,n=k.children("table");k=a.nScrollBody;var m=f(k),w=k.style,u=f(a.nScrollFoot).children("div"),q=u.children("table"),t=f(a.nTHead),r=f(a.nTable),v=r[0],za=v.style,T=a.nTFoot?f(a.nTFoot):null,A=a.oBrowser,
x=A.bScrollOversize,ac=J(a.aoColumns,"nTh"),Ya=[],y=[],z=[],C=[],G,H=function(a){a=a.style;a.paddingTop="0";a.paddingBottom="0";a.borderTopWidth="0";a.borderBottomWidth="0";a.height=0};var D=k.scrollHeight>k.clientHeight;if(a.scrollBarVis!==D&&a.scrollBarVis!==p)a.scrollBarVis=D,aa(a);else{a.scrollBarVis=D;r.children("thead, tfoot").remove();if(T){var E=T.clone().prependTo(r);var F=T.find("tr");E=E.find("tr")}var I=t.clone().prependTo(r);t=t.find("tr");D=I.find("tr");I.find("th, td").removeAttr("tabindex");
c||(w.width="100%",h[0].style.width="100%");f.each(ua(a,I),function(b,c){G=ba(a,b);c.style.width=a.aoColumns[G].sWidth});T&&N(function(a){a.style.width=""},E);h=r.outerWidth();""===c?(za.width="100%",x&&(r.find("tbody").height()>k.offsetHeight||"scroll"==m.css("overflow-y"))&&(za.width=B(r.outerWidth()-b)),h=r.outerWidth()):""!==d&&(za.width=B(d),h=r.outerWidth());N(H,D);N(function(a){z.push(a.innerHTML);Ya.push(B(f(a).css("width")))},D);N(function(a,b){-1!==f.inArray(a,ac)&&(a.style.width=Ya[b])},
t);f(D).height(0);T&&(N(H,E),N(function(a){C.push(a.innerHTML);y.push(B(f(a).css("width")))},E),N(function(a,b){a.style.width=y[b]},F),f(E).height(0));N(function(a,b){a.innerHTML='<div class="dataTables_sizing">'+z[b]+"</div>";a.childNodes[0].style.height="0";a.childNodes[0].style.overflow="hidden";a.style.width=Ya[b]},D);T&&N(function(a,b){a.innerHTML='<div class="dataTables_sizing">'+C[b]+"</div>";a.childNodes[0].style.height="0";a.childNodes[0].style.overflow="hidden";a.style.width=y[b]},E);r.outerWidth()<
h?(F=k.scrollHeight>k.offsetHeight||"scroll"==m.css("overflow-y")?h+b:h,x&&(k.scrollHeight>k.offsetHeight||"scroll"==m.css("overflow-y"))&&(za.width=B(F-b)),""!==c&&""===d||O(a,1,"Possible column misalignment",6)):F="100%";w.width=B(F);g.width=B(F);T&&(a.nScrollFoot.style.width=B(F));!e&&x&&(w.height=B(v.offsetHeight+b));c=r.outerWidth();n[0].style.width=B(c);l.width=B(c);d=r.height()>k.clientHeight||"scroll"==m.css("overflow-y");e="padding"+(A.bScrollbarLeft?"Left":"Right");l[e]=d?b+"px":"0px";T&&
(q[0].style.width=B(c),u[0].style.width=B(c),u[0].style[e]=d?b+"px":"0px");r.children("colgroup").insertBefore(r.children("thead"));m.trigger("scroll");!a.bSorted&&!a.bFiltered||a._drawHold||(k.scrollTop=0)}}function N(a,b,c){for(var d=0,e=0,h=b.length,g,k;e<h;){g=b[e].firstChild;for(k=c?c[e].firstChild:null;g;)1===g.nodeType&&(c?a(g,k,d):a(g,d),d++),g=g.nextSibling,k=c?k.nextSibling:null;e++}}function Ja(a){var b=a.nTable,c=a.aoColumns,d=a.oScroll,e=d.sY,h=d.sX,g=d.sXInner,k=c.length,l=oa(a,"bVisible"),
n=f("th",a.nTHead),m=b.getAttribute("width"),p=b.parentNode,u=!1,q,t=a.oBrowser;d=t.bScrollOversize;(q=b.style.width)&&-1!==q.indexOf("%")&&(m=q);for(q=0;q<l.length;q++){var r=c[l[q]];null!==r.sWidth&&(r.sWidth=Jb(r.sWidthOrig,p),u=!0)}if(d||!u&&!h&&!e&&k==W(a)&&k==n.length)for(q=0;q<k;q++)l=ba(a,q),null!==l&&(c[l].sWidth=B(n.eq(q).width()));else{k=f(b).clone().css("visibility","hidden").removeAttr("id");k.find("tbody tr").remove();var v=f("<tr/>").appendTo(k.find("tbody"));k.find("thead, tfoot").remove();
k.append(f(a.nTHead).clone()).append(f(a.nTFoot).clone());k.find("tfoot th, tfoot td").css("width","");n=ua(a,k.find("thead")[0]);for(q=0;q<l.length;q++)r=c[l[q]],n[q].style.width=null!==r.sWidthOrig&&""!==r.sWidthOrig?B(r.sWidthOrig):"",r.sWidthOrig&&h&&f(n[q]).append(f("<div/>").css({width:r.sWidthOrig,margin:0,padding:0,border:0,height:1}));if(a.aoData.length)for(q=0;q<l.length;q++)u=l[q],r=c[u],f(Kb(a,u)).clone(!1).append(r.sContentPadding).appendTo(v);f("[name]",k).removeAttr("name");r=f("<div/>").css(h||
e?{position:"absolute",top:0,left:0,height:1,right:0,overflow:"hidden"}:{}).append(k).appendTo(p);h&&g?k.width(g):h?(k.css("width","auto"),k.removeAttr("width"),k.width()<p.clientWidth&&m&&k.width(p.clientWidth)):e?k.width(p.clientWidth):m&&k.width(m);for(q=e=0;q<l.length;q++)p=f(n[q]),g=p.outerWidth()-p.width(),p=t.bBounding?Math.ceil(n[q].getBoundingClientRect().width):p.outerWidth(),e+=p,c[l[q]].sWidth=B(p-g);b.style.width=B(e);r.remove()}m&&(b.style.width=B(m));!m&&!h||a._reszEvt||(b=function(){f(z).on("resize.DT-"+
a.sInstance,Sa(function(){aa(a)}))},d?setTimeout(b,1E3):b(),a._reszEvt=!0)}function Jb(a,b){if(!a)return 0;a=f("<div/>").css("width",B(a)).appendTo(b||y.body);b=a[0].offsetWidth;a.remove();return b}function Kb(a,b){var c=Lb(a,b);if(0>c)return null;var d=a.aoData[c];return d.nTr?d.anCells[b]:f("<td/>").html(I(a,c,b,"display"))[0]}function Lb(a,b){for(var c,d=-1,e=-1,h=0,g=a.aoData.length;h<g;h++)c=I(a,h,b,"display")+"",c=c.replace(bc,""),c=c.replace(/&nbsp;/g," "),c.length>d&&(d=c.length,e=h);return e}
function B(a){return null===a?"0px":"number"==typeof a?0>a?"0px":a+"px":a.match(/\d$/)?a+"px":a}function Y(a){var b=[],c=a.aoColumns;var d=a.aaSortingFixed;var e=f.isPlainObject(d);var h=[];var g=function(a){a.length&&!f.isArray(a[0])?h.push(a):f.merge(h,a)};f.isArray(d)&&g(d);e&&d.pre&&g(d.pre);g(a.aaSorting);e&&d.post&&g(d.post);for(a=0;a<h.length;a++){var k=h[a][0];g=c[k].aDataSort;d=0;for(e=g.length;d<e;d++){var l=g[d];var n=c[l].sType||"string";h[a]._idx===p&&(h[a]._idx=f.inArray(h[a][1],c[l].asSorting));
b.push({src:k,col:l,dir:h[a][1],index:h[a]._idx,type:n,formatter:q.ext.type.order[n+"-pre"]})}}return b}function rb(a){var b,c=[],d=q.ext.type.order,e=a.aoData,h=0,g=a.aiDisplayMaster;Ka(a);var k=Y(a);var f=0;for(b=k.length;f<b;f++){var n=k[f];n.formatter&&h++;Mb(a,n.col)}if("ssp"!=D(a)&&0!==k.length){f=0;for(b=g.length;f<b;f++)c[g[f]]=f;h===k.length?g.sort(function(a,b){var d,h=k.length,g=e[a]._aSortData,f=e[b]._aSortData;for(d=0;d<h;d++){var l=k[d];var m=g[l.col];var n=f[l.col];m=m<n?-1:m>n?1:0;
if(0!==m)return"asc"===l.dir?m:-m}m=c[a];n=c[b];return m<n?-1:m>n?1:0}):g.sort(function(a,b){var h,g=k.length,f=e[a]._aSortData,l=e[b]._aSortData;for(h=0;h<g;h++){var m=k[h];var n=f[m.col];var p=l[m.col];m=d[m.type+"-"+m.dir]||d["string-"+m.dir];n=m(n,p);if(0!==n)return n}n=c[a];p=c[b];return n<p?-1:n>p?1:0})}a.bSorted=!0}function Nb(a){var b=a.aoColumns,c=Y(a);a=a.oLanguage.oAria;for(var d=0,e=b.length;d<e;d++){var h=b[d];var g=h.asSorting;var k=h.sTitle.replace(/<.*?>/g,"");var f=h.nTh;f.removeAttribute("aria-sort");
h.bSortable&&(0<c.length&&c[0].col==d?(f.setAttribute("aria-sort","asc"==c[0].dir?"ascending":"descending"),h=g[c[0].index+1]||g[0]):h=g[0],k+="asc"===h?a.sSortAscending:a.sSortDescending);f.setAttribute("aria-label",k)}}function Za(a,b,c,d){var e=a.aaSorting,h=a.aoColumns[b].asSorting,g=function(a,b){var c=a._idx;c===p&&(c=f.inArray(a[1],h));return c+1<h.length?c+1:b?null:0};"number"===typeof e[0]&&(e=a.aaSorting=[e]);c&&a.oFeatures.bSortMulti?(c=f.inArray(b,J(e,"0")),-1!==c?(b=g(e[c],!0),null===
b&&1===e.length&&(b=0),null===b?e.splice(c,1):(e[c][1]=h[b],e[c]._idx=b)):(e.push([b,h[0],0]),e[e.length-1]._idx=0)):e.length&&e[0][0]==b?(b=g(e[0]),e.length=1,e[0][1]=h[b],e[0]._idx=b):(e.length=0,e.push([b,h[0]]),e[0]._idx=0);V(a);"function"==typeof d&&d(a)}function Qa(a,b,c,d){var e=a.aoColumns[c];$a(b,{},function(b){!1!==e.bSortable&&(a.oFeatures.bProcessing?(K(a,!0),setTimeout(function(){Za(a,c,b.shiftKey,d);"ssp"!==D(a)&&K(a,!1)},0)):Za(a,c,b.shiftKey,d))})}function Aa(a){var b=a.aLastSort,
c=a.oClasses.sSortColumn,d=Y(a),e=a.oFeatures,h;if(e.bSort&&e.bSortClasses){e=0;for(h=b.length;e<h;e++){var g=b[e].src;f(J(a.aoData,"anCells",g)).removeClass(c+(2>e?e+1:3))}e=0;for(h=d.length;e<h;e++)g=d[e].src,f(J(a.aoData,"anCells",g)).addClass(c+(2>e?e+1:3))}a.aLastSort=d}function Mb(a,b){var c=a.aoColumns[b],d=q.ext.order[c.sSortDataType],e;d&&(e=d.call(a.oInstance,a,b,ca(a,b)));for(var h,g=q.ext.type.order[c.sType+"-pre"],k=0,f=a.aoData.length;k<f;k++)if(c=a.aoData[k],c._aSortData||(c._aSortData=
[]),!c._aSortData[b]||d)h=d?e[k]:I(a,k,b,"sort"),c._aSortData[b]=g?g(h):h}function Ba(a){if(a.oFeatures.bStateSave&&!a.bDestroying){var b={time:+new Date,start:a._iDisplayStart,length:a._iDisplayLength,order:f.extend(!0,[],a.aaSorting),search:Fb(a.oPreviousSearch),columns:f.map(a.aoColumns,function(b,d){return{visible:b.bVisible,search:Fb(a.aoPreSearchCols[d])}})};A(a,"aoStateSaveParams","stateSaveParams",[a,b]);a.oSavedState=b;a.fnStateSaveCallback.call(a.oInstance,a,b)}}function Ob(a,b,c){var d,
e,h=a.aoColumns;b=function(b){if(b&&b.time){var g=A(a,"aoStateLoadParams","stateLoadParams",[a,b]);if(-1===f.inArray(!1,g)&&(g=a.iStateDuration,!(0<g&&b.time<+new Date-1E3*g||b.columns&&h.length!==b.columns.length))){a.oLoadedState=f.extend(!0,{},b);b.start!==p&&(a._iDisplayStart=b.start,a.iInitDisplayStart=b.start);b.length!==p&&(a._iDisplayLength=b.length);b.order!==p&&(a.aaSorting=[],f.each(b.order,function(b,c){a.aaSorting.push(c[0]>=h.length?[0,c[1]]:c)}));b.search!==p&&f.extend(a.oPreviousSearch,
Gb(b.search));if(b.columns)for(d=0,e=b.columns.length;d<e;d++)g=b.columns[d],g.visible!==p&&(h[d].bVisible=g.visible),g.search!==p&&f.extend(a.aoPreSearchCols[d],Gb(g.search));A(a,"aoStateLoaded","stateLoaded",[a,b])}}c()};if(a.oFeatures.bStateSave){var g=a.fnStateLoadCallback.call(a.oInstance,a,b);g!==p&&b(g)}else c()}function Ca(a){var b=q.settings;a=f.inArray(a,J(b,"nTable"));return-1!==a?b[a]:null}function O(a,b,c,d){c="DataTables warning: "+(a?"table id="+a.sTableId+" - ":"")+c;d&&(c+=". For more information about this error, please see http://datatables.net/tn/"+
d);if(b)z.console&&console.log&&console.log(c);else if(b=q.ext,b=b.sErrMode||b.errMode,a&&A(a,null,"error",[a,d,c]),"alert"==b)alert(c);else{if("throw"==b)throw Error(c);"function"==typeof b&&b(a,d,c)}}function M(a,b,c,d){f.isArray(c)?f.each(c,function(c,d){f.isArray(d)?M(a,b,d[0],d[1]):M(a,b,d)}):(d===p&&(d=c),b[c]!==p&&(a[d]=b[c]))}function ab(a,b,c){var d;for(d in b)if(b.hasOwnProperty(d)){var e=b[d];f.isPlainObject(e)?(f.isPlainObject(a[d])||(a[d]={}),f.extend(!0,a[d],e)):c&&"data"!==d&&"aaData"!==
d&&f.isArray(e)?a[d]=e.slice():a[d]=e}return a}function $a(a,b,c){f(a).on("click.DT",b,function(b){f(a).blur();c(b)}).on("keypress.DT",b,function(a){13===a.which&&(a.preventDefault(),c(a))}).on("selectstart.DT",function(){return!1})}function E(a,b,c,d){c&&a[b].push({fn:c,sName:d})}function A(a,b,c,d){var e=[];b&&(e=f.map(a[b].slice().reverse(),function(b,c){return b.fn.apply(a.oInstance,d)}));null!==c&&(b=f.Event(c+".dt"),f(a.nTable).trigger(b,d),e.push(b.result));return e}function Wa(a){var b=a._iDisplayStart,
c=a.fnDisplayEnd(),d=a._iDisplayLength;b>=c&&(b=c-d);b-=b%d;if(-1===d||0>b)b=0;a._iDisplayStart=b}function Ra(a,b){a=a.renderer;var c=q.ext.renderer[b];return f.isPlainObject(a)&&a[b]?c[a[b]]||c._:"string"===typeof a?c[a]||c._:c._}function D(a){return a.oFeatures.bServerSide?"ssp":a.ajax||a.sAjaxSource?"ajax":"dom"}function ka(a,b){var c=Pb.numbers_length,d=Math.floor(c/2);b<=c?a=Z(0,b):a<=d?(a=Z(0,c-2),a.push("ellipsis"),a.push(b-1)):(a>=b-1-d?a=Z(b-(c-2),b):(a=Z(a-d+2,a+d-1),a.push("ellipsis"),
a.push(b-1)),a.splice(0,0,"ellipsis"),a.splice(0,0,0));a.DT_el="span";return a}function Ha(a){f.each({num:function(b){return Da(b,a)},"num-fmt":function(b){return Da(b,a,bb)},"html-num":function(b){return Da(b,a,Ea)},"html-num-fmt":function(b){return Da(b,a,Ea,bb)}},function(b,c){C.type.order[b+a+"-pre"]=c;b.match(/^html\-/)&&(C.type.search[b+a]=C.type.search.html)})}function Qb(a){return function(){var b=[Ca(this[q.ext.iApiIndex])].concat(Array.prototype.slice.call(arguments));return q.ext.internal[a].apply(this,
b)}}var q=function(a){this.$=function(a,b){return this.api(!0).$(a,b)};this._=function(a,b){return this.api(!0).rows(a,b).data()};this.api=function(a){return a?new v(Ca(this[C.iApiIndex])):new v(this)};this.fnAddData=function(a,b){var c=this.api(!0);a=f.isArray(a)&&(f.isArray(a[0])||f.isPlainObject(a[0]))?c.rows.add(a):c.row.add(a);(b===p||b)&&c.draw();return a.flatten().toArray()};this.fnAdjustColumnSizing=function(a){var b=this.api(!0).columns.adjust(),c=b.settings()[0],d=c.oScroll;a===p||a?b.draw(!1):
(""!==d.sX||""!==d.sY)&&na(c)};this.fnClearTable=function(a){var b=this.api(!0).clear();(a===p||a)&&b.draw()};this.fnClose=function(a){this.api(!0).row(a).child.hide()};this.fnDeleteRow=function(a,b,c){var d=this.api(!0);a=d.rows(a);var e=a.settings()[0],h=e.aoData[a[0][0]];a.remove();b&&b.call(this,e,h);(c===p||c)&&d.draw();return h};this.fnDestroy=function(a){this.api(!0).destroy(a)};this.fnDraw=function(a){this.api(!0).draw(a)};this.fnFilter=function(a,b,c,d,e,f){e=this.api(!0);null===b||b===p?
e.search(a,c,d,f):e.column(b).search(a,c,d,f);e.draw()};this.fnGetData=function(a,b){var c=this.api(!0);if(a!==p){var d=a.nodeName?a.nodeName.toLowerCase():"";return b!==p||"td"==d||"th"==d?c.cell(a,b).data():c.row(a).data()||null}return c.data().toArray()};this.fnGetNodes=function(a){var b=this.api(!0);return a!==p?b.row(a).node():b.rows().nodes().flatten().toArray()};this.fnGetPosition=function(a){var b=this.api(!0),c=a.nodeName.toUpperCase();return"TR"==c?b.row(a).index():"TD"==c||"TH"==c?(a=b.cell(a).index(),
[a.row,a.columnVisible,a.column]):null};this.fnIsOpen=function(a){return this.api(!0).row(a).child.isShown()};this.fnOpen=function(a,b,c){return this.api(!0).row(a).child(b,c).show().child()[0]};this.fnPageChange=function(a,b){a=this.api(!0).page(a);(b===p||b)&&a.draw(!1)};this.fnSetColumnVis=function(a,b,c){a=this.api(!0).column(a).visible(b);(c===p||c)&&a.columns.adjust().draw()};this.fnSettings=function(){return Ca(this[C.iApiIndex])};this.fnSort=function(a){this.api(!0).order(a).draw()};this.fnSortListener=
function(a,b,c){this.api(!0).order.listener(a,b,c)};this.fnUpdate=function(a,b,c,d,e){var h=this.api(!0);c===p||null===c?h.row(b).data(a):h.cell(b,c).data(a);(e===p||e)&&h.columns.adjust();(d===p||d)&&h.draw();return 0};this.fnVersionCheck=C.fnVersionCheck;var b=this,c=a===p,d=this.length;c&&(a={});this.oApi=this.internal=C.internal;for(var e in q.ext.internal)e&&(this[e]=Qb(e));this.each(function(){var e={},g=1<d?ab(e,a,!0):a,k=0,l;e=this.getAttribute("id");var n=!1,m=q.defaults,w=f(this);if("table"!=
this.nodeName.toLowerCase())O(null,0,"Non-table node initialisation ("+this.nodeName+")",2);else{jb(m);kb(m.column);L(m,m,!0);L(m.column,m.column,!0);L(m,f.extend(g,w.data()),!0);var u=q.settings;k=0;for(l=u.length;k<l;k++){var t=u[k];if(t.nTable==this||t.nTHead&&t.nTHead.parentNode==this||t.nTFoot&&t.nTFoot.parentNode==this){var v=g.bRetrieve!==p?g.bRetrieve:m.bRetrieve;if(c||v)return t.oInstance;if(g.bDestroy!==p?g.bDestroy:m.bDestroy){t.oInstance.fnDestroy();break}else{O(t,0,"Cannot reinitialise DataTable",
3);return}}if(t.sTableId==this.id){u.splice(k,1);break}}if(null===e||""===e)this.id=e="DataTables_Table_"+q.ext._unique++;var r=f.extend(!0,{},q.models.oSettings,{sDestroyWidth:w[0].style.width,sInstance:e,sTableId:e});r.nTable=this;r.oApi=b.internal;r.oInit=g;u.push(r);r.oInstance=1===b.length?b:w.dataTable();jb(g);Ga(g.oLanguage);g.aLengthMenu&&!g.iDisplayLength&&(g.iDisplayLength=f.isArray(g.aLengthMenu[0])?g.aLengthMenu[0][0]:g.aLengthMenu[0]);g=ab(f.extend(!0,{},m),g);M(r.oFeatures,g,"bPaginate bLengthChange bFilter bSort bSortMulti bInfo bProcessing bAutoWidth bSortClasses bServerSide bDeferRender".split(" "));
M(r,g,["asStripeClasses","ajax","fnServerData","fnFormatNumber","sServerMethod","aaSorting","aaSortingFixed","aLengthMenu","sPaginationType","sAjaxSource","sAjaxDataProp","iStateDuration","sDom","bSortCellsTop","iTabIndex","fnStateLoadCallback","fnStateSaveCallback","renderer","searchDelay","rowId",["iCookieDuration","iStateDuration"],["oSearch","oPreviousSearch"],["aoSearchCols","aoPreSearchCols"],["iDisplayLength","_iDisplayLength"]]);M(r.oScroll,g,[["sScrollX","sX"],["sScrollXInner","sXInner"],
["sScrollY","sY"],["bScrollCollapse","bCollapse"]]);M(r.oLanguage,g,"fnInfoCallback");E(r,"aoDrawCallback",g.fnDrawCallback,"user");E(r,"aoServerParams",g.fnServerParams,"user");E(r,"aoStateSaveParams",g.fnStateSaveParams,"user");E(r,"aoStateLoadParams",g.fnStateLoadParams,"user");E(r,"aoStateLoaded",g.fnStateLoaded,"user");E(r,"aoRowCallback",g.fnRowCallback,"user");E(r,"aoRowCreatedCallback",g.fnCreatedRow,"user");E(r,"aoHeaderCallback",g.fnHeaderCallback,"user");E(r,"aoFooterCallback",g.fnFooterCallback,
"user");E(r,"aoInitComplete",g.fnInitComplete,"user");E(r,"aoPreDrawCallback",g.fnPreDrawCallback,"user");r.rowIdFn=U(g.rowId);lb(r);var x=r.oClasses;f.extend(x,q.ext.classes,g.oClasses);w.addClass(x.sTable);r.iInitDisplayStart===p&&(r.iInitDisplayStart=g.iDisplayStart,r._iDisplayStart=g.iDisplayStart);null!==g.iDeferLoading&&(r.bDeferLoading=!0,e=f.isArray(g.iDeferLoading),r._iRecordsDisplay=e?g.iDeferLoading[0]:g.iDeferLoading,r._iRecordsTotal=e?g.iDeferLoading[1]:g.iDeferLoading);var y=r.oLanguage;
f.extend(!0,y,g.oLanguage);y.sUrl&&(f.ajax({dataType:"json",url:y.sUrl,success:function(a){Ga(a);L(m.oLanguage,a);f.extend(!0,y,a);ja(r)},error:function(){ja(r)}}),n=!0);null===g.asStripeClasses&&(r.asStripeClasses=[x.sStripeOdd,x.sStripeEven]);e=r.asStripeClasses;var z=w.children("tbody").find("tr").eq(0);-1!==f.inArray(!0,f.map(e,function(a,b){return z.hasClass(a)}))&&(f("tbody tr",this).removeClass(e.join(" ")),r.asDestroyStripes=e.slice());e=[];u=this.getElementsByTagName("thead");0!==u.length&&
(fa(r.aoHeader,u[0]),e=ua(r));if(null===g.aoColumns)for(u=[],k=0,l=e.length;k<l;k++)u.push(null);else u=g.aoColumns;k=0;for(l=u.length;k<l;k++)Ia(r,e?e[k]:null);nb(r,g.aoColumnDefs,u,function(a,b){ma(r,a,b)});if(z.length){var B=function(a,b){return null!==a.getAttribute("data-"+b)?b:null};f(z[0]).children("th, td").each(function(a,b){var c=r.aoColumns[a];if(c.mData===a){var d=B(b,"sort")||B(b,"order");b=B(b,"filter")||B(b,"search");if(null!==d||null!==b)c.mData={_:a+".display",sort:null!==d?a+".@data-"+
d:p,type:null!==d?a+".@data-"+d:p,filter:null!==b?a+".@data-"+b:p},ma(r,a)}})}var C=r.oFeatures;e=function(){if(g.aaSorting===p){var a=r.aaSorting;k=0;for(l=a.length;k<l;k++)a[k][1]=r.aoColumns[k].asSorting[0]}Aa(r);C.bSort&&E(r,"aoDrawCallback",function(){if(r.bSorted){var a=Y(r),b={};f.each(a,function(a,c){b[c.src]=c.dir});A(r,null,"order",[r,a,b]);Nb(r)}});E(r,"aoDrawCallback",function(){(r.bSorted||"ssp"===D(r)||C.bDeferRender)&&Aa(r)},"sc");a=w.children("caption").each(function(){this._captionSide=
f(this).css("caption-side")});var b=w.children("thead");0===b.length&&(b=f("<thead/>").appendTo(w));r.nTHead=b[0];b=w.children("tbody");0===b.length&&(b=f("<tbody/>").appendTo(w));r.nTBody=b[0];b=w.children("tfoot");0===b.length&&0<a.length&&(""!==r.oScroll.sX||""!==r.oScroll.sY)&&(b=f("<tfoot/>").appendTo(w));0===b.length||0===b.children().length?w.addClass(x.sNoFooter):0<b.length&&(r.nTFoot=b[0],fa(r.aoFooter,r.nTFoot));if(g.aaData)for(k=0;k<g.aaData.length;k++)R(r,g.aaData[k]);else(r.bDeferLoading||
"dom"==D(r))&&pa(r,f(r.nTBody).children("tr"));r.aiDisplay=r.aiDisplayMaster.slice();r.bInitialised=!0;!1===n&&ja(r)};g.bStateSave?(C.bStateSave=!0,E(r,"aoDrawCallback",Ba,"state_save"),Ob(r,g,e)):e()}});b=null;return this},C,t,x,cb={},Rb=/[\r\n\u2028]/g,Ea=/<.*?>/g,cc=/^\d{2,4}[\.\/\-]\d{1,2}[\.\/\-]\d{1,2}([T ]{1}\d{1,2}[:\.]\d{2}([\.:]\d{2})?)?$/,dc=/(\/|\.|\*|\+|\?|\||\(|\)|\[|\]|\{|\}|\\|\$|\^|\-)/g,bb=/[',$£€¥%\u2009\u202F\u20BD\u20a9\u20BArfkɃΞ]/gi,P=function(a){return a&&!0!==a&&"-"!==a?!1:
!0},Sb=function(a){var b=parseInt(a,10);return!isNaN(b)&&isFinite(a)?b:null},Tb=function(a,b){cb[b]||(cb[b]=new RegExp(Ua(b),"g"));return"string"===typeof a&&"."!==b?a.replace(/\./g,"").replace(cb[b],"."):a},db=function(a,b,c){var d="string"===typeof a;if(P(a))return!0;b&&d&&(a=Tb(a,b));c&&d&&(a=a.replace(bb,""));return!isNaN(parseFloat(a))&&isFinite(a)},Ub=function(a,b,c){return P(a)?!0:P(a)||"string"===typeof a?db(a.replace(Ea,""),b,c)?!0:null:null},J=function(a,b,c){var d=[],e=0,h=a.length;if(c!==
p)for(;e<h;e++)a[e]&&a[e][b]&&d.push(a[e][b][c]);else for(;e<h;e++)a[e]&&d.push(a[e][b]);return d},la=function(a,b,c,d){var e=[],h=0,g=b.length;if(d!==p)for(;h<g;h++)a[b[h]][c]&&e.push(a[b[h]][c][d]);else for(;h<g;h++)e.push(a[b[h]][c]);return e},Z=function(a,b){var c=[];if(b===p){b=0;var d=a}else d=b,b=a;for(a=b;a<d;a++)c.push(a);return c},Vb=function(a){for(var b=[],c=0,d=a.length;c<d;c++)a[c]&&b.push(a[c]);return b},ta=function(a){a:{if(!(2>a.length)){var b=a.slice().sort();for(var c=b[0],d=1,
e=b.length;d<e;d++){if(b[d]===c){b=!1;break a}c=b[d]}}b=!0}if(b)return a.slice();b=[];e=a.length;var h,g=0;d=0;a:for(;d<e;d++){c=a[d];for(h=0;h<g;h++)if(b[h]===c)continue a;b.push(c);g++}return b};q.util={throttle:function(a,b){var c=b!==p?b:200,d,e;return function(){var b=this,g=+new Date,f=arguments;d&&g<d+c?(clearTimeout(e),e=setTimeout(function(){d=p;a.apply(b,f)},c)):(d=g,a.apply(b,f))}},escapeRegex:function(a){return a.replace(dc,"\\$1")}};var F=function(a,b,c){a[b]!==p&&(a[c]=a[b])},da=/\[.*?\]$/,
X=/\(\)$/,Ua=q.util.escapeRegex,ya=f("<div>")[0],$b=ya.textContent!==p,bc=/<.*?>/g,Sa=q.util.throttle,Wb=[],G=Array.prototype,ec=function(a){var b,c=q.settings,d=f.map(c,function(a,b){return a.nTable});if(a){if(a.nTable&&a.oApi)return[a];if(a.nodeName&&"table"===a.nodeName.toLowerCase()){var e=f.inArray(a,d);return-1!==e?[c[e]]:null}if(a&&"function"===typeof a.settings)return a.settings().toArray();"string"===typeof a?b=f(a):a instanceof f&&(b=a)}else return[];if(b)return b.map(function(a){e=f.inArray(this,
d);return-1!==e?c[e]:null}).toArray()};var v=function(a,b){if(!(this instanceof v))return new v(a,b);var c=[],d=function(a){(a=ec(a))&&c.push.apply(c,a)};if(f.isArray(a))for(var e=0,h=a.length;e<h;e++)d(a[e]);else d(a);this.context=ta(c);b&&f.merge(this,b);this.selector={rows:null,cols:null,opts:null};v.extend(this,this,Wb)};q.Api=v;f.extend(v.prototype,{any:function(){return 0!==this.count()},concat:G.concat,context:[],count:function(){return this.flatten().length},each:function(a){for(var b=0,c=
this.length;b<c;b++)a.call(this,this[b],b,this);return this},eq:function(a){var b=this.context;return b.length>a?new v(b[a],this[a]):null},filter:function(a){var b=[];if(G.filter)b=G.filter.call(this,a,this);else for(var c=0,d=this.length;c<d;c++)a.call(this,this[c],c,this)&&b.push(this[c]);return new v(this.context,b)},flatten:function(){var a=[];return new v(this.context,a.concat.apply(a,this.toArray()))},join:G.join,indexOf:G.indexOf||function(a,b){b=b||0;for(var c=this.length;b<c;b++)if(this[b]===
a)return b;return-1},iterator:function(a,b,c,d){var e=[],h,g,f=this.context,l,n=this.selector;"string"===typeof a&&(d=c,c=b,b=a,a=!1);var m=0;for(h=f.length;m<h;m++){var q=new v(f[m]);if("table"===b){var u=c.call(q,f[m],m);u!==p&&e.push(u)}else if("columns"===b||"rows"===b)u=c.call(q,f[m],this[m],m),u!==p&&e.push(u);else if("column"===b||"column-rows"===b||"row"===b||"cell"===b){var t=this[m];"column-rows"===b&&(l=Fa(f[m],n.opts));var x=0;for(g=t.length;x<g;x++)u=t[x],u="cell"===b?c.call(q,f[m],u.row,
u.column,m,x):c.call(q,f[m],u,m,x,l),u!==p&&e.push(u)}}return e.length||d?(a=new v(f,a?e.concat.apply([],e):e),b=a.selector,b.rows=n.rows,b.cols=n.cols,b.opts=n.opts,a):this},lastIndexOf:G.lastIndexOf||function(a,b){return this.indexOf.apply(this.toArray.reverse(),arguments)},length:0,map:function(a){var b=[];if(G.map)b=G.map.call(this,a,this);else for(var c=0,d=this.length;c<d;c++)b.push(a.call(this,this[c],c));return new v(this.context,b)},pluck:function(a){return this.map(function(b){return b[a]})},
pop:G.pop,push:G.push,reduce:G.reduce||function(a,b){return mb(this,a,b,0,this.length,1)},reduceRight:G.reduceRight||function(a,b){return mb(this,a,b,this.length-1,-1,-1)},reverse:G.reverse,selector:null,shift:G.shift,slice:function(){return new v(this.context,this)},sort:G.sort,splice:G.splice,toArray:function(){return G.slice.call(this)},to$:function(){return f(this)},toJQuery:function(){return f(this)},unique:function(){return new v(this.context,ta(this))},unshift:G.unshift});v.extend=function(a,
b,c){if(c.length&&b&&(b instanceof v||b.__dt_wrapper)){var d,e=function(a,b,c){return function(){var d=b.apply(a,arguments);v.extend(d,d,c.methodExt);return d}};var h=0;for(d=c.length;h<d;h++){var g=c[h];b[g.name]="function"===g.type?e(a,g.val,g):"object"===g.type?{}:g.val;b[g.name].__dt_wrapper=!0;v.extend(a,b[g.name],g.propExt)}}};v.register=t=function(a,b){if(f.isArray(a))for(var c=0,d=a.length;c<d;c++)v.register(a[c],b);else{d=a.split(".");var e=Wb,h;a=0;for(c=d.length;a<c;a++){var g=(h=-1!==
d[a].indexOf("()"))?d[a].replace("()",""):d[a];a:{var k=0;for(var l=e.length;k<l;k++)if(e[k].name===g){k=e[k];break a}k=null}k||(k={name:g,val:{},methodExt:[],propExt:[],type:"object"},e.push(k));a===c-1?(k.val=b,k.type="function"===typeof b?"function":f.isPlainObject(b)?"object":"other"):e=h?k.methodExt:k.propExt}}};v.registerPlural=x=function(a,b,c){v.register(a,c);v.register(b,function(){var a=c.apply(this,arguments);return a===this?this:a instanceof v?a.length?f.isArray(a[0])?new v(a.context,
a[0]):a[0]:p:a})};var fc=function(a,b){if("number"===typeof a)return[b[a]];var c=f.map(b,function(a,b){return a.nTable});return f(c).filter(a).map(function(a){a=f.inArray(this,c);return b[a]}).toArray()};t("tables()",function(a){return a?new v(fc(a,this.context)):this});t("table()",function(a){a=this.tables(a);var b=a.context;return b.length?new v(b[0]):a});x("tables().nodes()","table().node()",function(){return this.iterator("table",function(a){return a.nTable},1)});x("tables().body()","table().body()",
function(){return this.iterator("table",function(a){return a.nTBody},1)});x("tables().header()","table().header()",function(){return this.iterator("table",function(a){return a.nTHead},1)});x("tables().footer()","table().footer()",function(){return this.iterator("table",function(a){return a.nTFoot},1)});x("tables().containers()","table().container()",function(){return this.iterator("table",function(a){return a.nTableWrapper},1)});t("draw()",function(a){return this.iterator("table",function(b){"page"===
a?S(b):("string"===typeof a&&(a="full-hold"===a?!1:!0),V(b,!1===a))})});t("page()",function(a){return a===p?this.page.info().page:this.iterator("table",function(b){Xa(b,a)})});t("page.info()",function(a){if(0===this.context.length)return p;a=this.context[0];var b=a._iDisplayStart,c=a.oFeatures.bPaginate?a._iDisplayLength:-1,d=a.fnRecordsDisplay(),e=-1===c;return{page:e?0:Math.floor(b/c),pages:e?1:Math.ceil(d/c),start:b,end:a.fnDisplayEnd(),length:c,recordsTotal:a.fnRecordsTotal(),recordsDisplay:d,
serverSide:"ssp"===D(a)}});t("page.len()",function(a){return a===p?0!==this.context.length?this.context[0]._iDisplayLength:p:this.iterator("table",function(b){Va(b,a)})});var Xb=function(a,b,c){if(c){var d=new v(a);d.one("draw",function(){c(d.ajax.json())})}if("ssp"==D(a))V(a,b);else{K(a,!0);var e=a.jqXHR;e&&4!==e.readyState&&e.abort();va(a,[],function(c){qa(a);c=wa(a,c);for(var d=0,e=c.length;d<e;d++)R(a,c[d]);V(a,b);K(a,!1)})}};t("ajax.json()",function(){var a=this.context;if(0<a.length)return a[0].json});
t("ajax.params()",function(){var a=this.context;if(0<a.length)return a[0].oAjaxData});t("ajax.reload()",function(a,b){return this.iterator("table",function(c){Xb(c,!1===b,a)})});t("ajax.url()",function(a){var b=this.context;if(a===p){if(0===b.length)return p;b=b[0];return b.ajax?f.isPlainObject(b.ajax)?b.ajax.url:b.ajax:b.sAjaxSource}return this.iterator("table",function(b){f.isPlainObject(b.ajax)?b.ajax.url=a:b.ajax=a})});t("ajax.url().load()",function(a,b){return this.iterator("table",function(c){Xb(c,
!1===b,a)})});var eb=function(a,b,c,d,e){var h=[],g,k,l;var n=typeof b;b&&"string"!==n&&"function"!==n&&b.length!==p||(b=[b]);n=0;for(k=b.length;n<k;n++){var m=b[n]&&b[n].split&&!b[n].match(/[\[\(:]/)?b[n].split(","):[b[n]];var q=0;for(l=m.length;q<l;q++)(g=c("string"===typeof m[q]?f.trim(m[q]):m[q]))&&g.length&&(h=h.concat(g))}a=C.selector[a];if(a.length)for(n=0,k=a.length;n<k;n++)h=a[n](d,e,h);return ta(h)},fb=function(a){a||(a={});a.filter&&a.search===p&&(a.search=a.filter);return f.extend({search:"none",
order:"current",page:"all"},a)},gb=function(a){for(var b=0,c=a.length;b<c;b++)if(0<a[b].length)return a[0]=a[b],a[0].length=1,a.length=1,a.context=[a.context[b]],a;a.length=0;return a},Fa=function(a,b){var c=[],d=a.aiDisplay;var e=a.aiDisplayMaster;var h=b.search;var g=b.order;b=b.page;if("ssp"==D(a))return"removed"===h?[]:Z(0,e.length);if("current"==b)for(g=a._iDisplayStart,a=a.fnDisplayEnd();g<a;g++)c.push(d[g]);else if("current"==g||"applied"==g)if("none"==h)c=e.slice();else if("applied"==h)c=
d.slice();else{if("removed"==h){var k={};g=0;for(a=d.length;g<a;g++)k[d[g]]=null;c=f.map(e,function(a){return k.hasOwnProperty(a)?null:a})}}else if("index"==g||"original"==g)for(g=0,a=a.aoData.length;g<a;g++)"none"==h?c.push(g):(e=f.inArray(g,d),(-1===e&&"removed"==h||0<=e&&"applied"==h)&&c.push(g));return c},gc=function(a,b,c){var d;return eb("row",b,function(b){var e=Sb(b),g=a.aoData;if(null!==e&&!c)return[e];d||(d=Fa(a,c));if(null!==e&&-1!==f.inArray(e,d))return[e];if(null===b||b===p||""===b)return d;
if("function"===typeof b)return f.map(d,function(a){var c=g[a];return b(a,c._aData,c.nTr)?a:null});if(b.nodeName){e=b._DT_RowIndex;var k=b._DT_CellIndex;if(e!==p)return g[e]&&g[e].nTr===b?[e]:[];if(k)return g[k.row]&&g[k.row].nTr===b.parentNode?[k.row]:[];e=f(b).closest("*[data-dt-row]");return e.length?[e.data("dt-row")]:[]}if("string"===typeof b&&"#"===b.charAt(0)&&(e=a.aIds[b.replace(/^#/,"")],e!==p))return[e.idx];e=Vb(la(a.aoData,d,"nTr"));return f(e).filter(b).map(function(){return this._DT_RowIndex}).toArray()},
a,c)};t("rows()",function(a,b){a===p?a="":f.isPlainObject(a)&&(b=a,a="");b=fb(b);var c=this.iterator("table",function(c){return gc(c,a,b)},1);c.selector.rows=a;c.selector.opts=b;return c});t("rows().nodes()",function(){return this.iterator("row",function(a,b){return a.aoData[b].nTr||p},1)});t("rows().data()",function(){return this.iterator(!0,"rows",function(a,b){return la(a.aoData,b,"_aData")},1)});x("rows().cache()","row().cache()",function(a){return this.iterator("row",function(b,c){b=b.aoData[c];
return"search"===a?b._aFilterData:b._aSortData},1)});x("rows().invalidate()","row().invalidate()",function(a){return this.iterator("row",function(b,c){ea(b,c,a)})});x("rows().indexes()","row().index()",function(){return this.iterator("row",function(a,b){return b},1)});x("rows().ids()","row().id()",function(a){for(var b=[],c=this.context,d=0,e=c.length;d<e;d++)for(var h=0,g=this[d].length;h<g;h++){var f=c[d].rowIdFn(c[d].aoData[this[d][h]]._aData);b.push((!0===a?"#":"")+f)}return new v(c,b)});x("rows().remove()",
"row().remove()",function(){var a=this;this.iterator("row",function(b,c,d){var e=b.aoData,h=e[c],g,f;e.splice(c,1);var l=0;for(g=e.length;l<g;l++){var n=e[l];var m=n.anCells;null!==n.nTr&&(n.nTr._DT_RowIndex=l);if(null!==m)for(n=0,f=m.length;n<f;n++)m[n]._DT_CellIndex.row=l}ra(b.aiDisplayMaster,c);ra(b.aiDisplay,c);ra(a[d],c,!1);0<b._iRecordsDisplay&&b._iRecordsDisplay--;Wa(b);c=b.rowIdFn(h._aData);c!==p&&delete b.aIds[c]});this.iterator("table",function(a){for(var b=0,d=a.aoData.length;b<d;b++)a.aoData[b].idx=
b});return this});t("rows.add()",function(a){var b=this.iterator("table",function(b){var c,d=[];var g=0;for(c=a.length;g<c;g++){var f=a[g];f.nodeName&&"TR"===f.nodeName.toUpperCase()?d.push(pa(b,f)[0]):d.push(R(b,f))}return d},1),c=this.rows(-1);c.pop();f.merge(c,b);return c});t("row()",function(a,b){return gb(this.rows(a,b))});t("row().data()",function(a){var b=this.context;if(a===p)return b.length&&this.length?b[0].aoData[this[0]]._aData:p;var c=b[0].aoData[this[0]];c._aData=a;f.isArray(a)&&c.nTr.id&&
Q(b[0].rowId)(a,c.nTr.id);ea(b[0],this[0],"data");return this});t("row().node()",function(){var a=this.context;return a.length&&this.length?a[0].aoData[this[0]].nTr||null:null});t("row.add()",function(a){a instanceof f&&a.length&&(a=a[0]);var b=this.iterator("table",function(b){return a.nodeName&&"TR"===a.nodeName.toUpperCase()?pa(b,a)[0]:R(b,a)});return this.row(b[0])});var hc=function(a,b,c,d){var e=[],h=function(b,c){if(f.isArray(b)||b instanceof f)for(var d=0,g=b.length;d<g;d++)h(b[d],c);else b.nodeName&&
"tr"===b.nodeName.toLowerCase()?e.push(b):(d=f("<tr><td/></tr>").addClass(c),f("td",d).addClass(c).html(b)[0].colSpan=W(a),e.push(d[0]))};h(c,d);b._details&&b._details.detach();b._details=f(e);b._detailsShow&&b._details.insertAfter(b.nTr)},hb=function(a,b){var c=a.context;c.length&&(a=c[0].aoData[b!==p?b:a[0]])&&a._details&&(a._details.remove(),a._detailsShow=p,a._details=p)},Yb=function(a,b){var c=a.context;c.length&&a.length&&(a=c[0].aoData[a[0]],a._details&&((a._detailsShow=b)?a._details.insertAfter(a.nTr):
a._details.detach(),ic(c[0])))},ic=function(a){var b=new v(a),c=a.aoData;b.off("draw.dt.DT_details column-visibility.dt.DT_details destroy.dt.DT_details");0<J(c,"_details").length&&(b.on("draw.dt.DT_details",function(d,e){a===e&&b.rows({page:"current"}).eq(0).each(function(a){a=c[a];a._detailsShow&&a._details.insertAfter(a.nTr)})}),b.on("column-visibility.dt.DT_details",function(b,e,f,g){if(a===e)for(e=W(e),f=0,g=c.length;f<g;f++)b=c[f],b._details&&b._details.children("td[colspan]").attr("colspan",
e)}),b.on("destroy.dt.DT_details",function(d,e){if(a===e)for(d=0,e=c.length;d<e;d++)c[d]._details&&hb(b,d)}))};t("row().child()",function(a,b){var c=this.context;if(a===p)return c.length&&this.length?c[0].aoData[this[0]]._details:p;!0===a?this.child.show():!1===a?hb(this):c.length&&this.length&&hc(c[0],c[0].aoData[this[0]],a,b);return this});t(["row().child.show()","row().child().show()"],function(a){Yb(this,!0);return this});t(["row().child.hide()","row().child().hide()"],function(){Yb(this,!1);
return this});t(["row().child.remove()","row().child().remove()"],function(){hb(this);return this});t("row().child.isShown()",function(){var a=this.context;return a.length&&this.length?a[0].aoData[this[0]]._detailsShow||!1:!1});var jc=/^([^:]+):(name|visIdx|visible)$/,Zb=function(a,b,c,d,e){c=[];d=0;for(var f=e.length;d<f;d++)c.push(I(a,e[d],b));return c},kc=function(a,b,c){var d=a.aoColumns,e=J(d,"sName"),h=J(d,"nTh");return eb("column",b,function(b){var g=Sb(b);if(""===b)return Z(d.length);if(null!==
g)return[0<=g?g:d.length+g];if("function"===typeof b){var l=Fa(a,c);return f.map(d,function(c,d){return b(d,Zb(a,d,0,0,l),h[d])?d:null})}var n="string"===typeof b?b.match(jc):"";if(n)switch(n[2]){case "visIdx":case "visible":g=parseInt(n[1],10);if(0>g){var m=f.map(d,function(a,b){return a.bVisible?b:null});return[m[m.length+g]]}return[ba(a,g)];case "name":return f.map(e,function(a,b){return a===n[1]?b:null});default:return[]}if(b.nodeName&&b._DT_CellIndex)return[b._DT_CellIndex.column];g=f(h).filter(b).map(function(){return f.inArray(this,
h)}).toArray();if(g.length||!b.nodeName)return g;g=f(b).closest("*[data-dt-column]");return g.length?[g.data("dt-column")]:[]},a,c)};t("columns()",function(a,b){a===p?a="":f.isPlainObject(a)&&(b=a,a="");b=fb(b);var c=this.iterator("table",function(c){return kc(c,a,b)},1);c.selector.cols=a;c.selector.opts=b;return c});x("columns().header()","column().header()",function(a,b){return this.iterator("column",function(a,b){return a.aoColumns[b].nTh},1)});x("columns().footer()","column().footer()",function(a,
b){return this.iterator("column",function(a,b){return a.aoColumns[b].nTf},1)});x("columns().data()","column().data()",function(){return this.iterator("column-rows",Zb,1)});x("columns().dataSrc()","column().dataSrc()",function(){return this.iterator("column",function(a,b){return a.aoColumns[b].mData},1)});x("columns().cache()","column().cache()",function(a){return this.iterator("column-rows",function(b,c,d,e,f){return la(b.aoData,f,"search"===a?"_aFilterData":"_aSortData",c)},1)});x("columns().nodes()",
"column().nodes()",function(){return this.iterator("column-rows",function(a,b,c,d,e){return la(a.aoData,e,"anCells",b)},1)});x("columns().visible()","column().visible()",function(a,b){var c=this,d=this.iterator("column",function(b,c){if(a===p)return b.aoColumns[c].bVisible;var d=b.aoColumns,e=d[c],h=b.aoData,n;if(a!==p&&e.bVisible!==a){if(a){var m=f.inArray(!0,J(d,"bVisible"),c+1);d=0;for(n=h.length;d<n;d++){var q=h[d].nTr;b=h[d].anCells;q&&q.insertBefore(b[c],b[m]||null)}}else f(J(b.aoData,"anCells",
c)).detach();e.bVisible=a}});a!==p&&this.iterator("table",function(d){ha(d,d.aoHeader);ha(d,d.aoFooter);d.aiDisplay.length||f(d.nTBody).find("td[colspan]").attr("colspan",W(d));Ba(d);c.iterator("column",function(c,d){A(c,null,"column-visibility",[c,d,a,b])});(b===p||b)&&c.columns.adjust()});return d});x("columns().indexes()","column().index()",function(a){return this.iterator("column",function(b,c){return"visible"===a?ca(b,c):c},1)});t("columns.adjust()",function(){return this.iterator("table",function(a){aa(a)},
1)});t("column.index()",function(a,b){if(0!==this.context.length){var c=this.context[0];if("fromVisible"===a||"toData"===a)return ba(c,b);if("fromData"===a||"toVisible"===a)return ca(c,b)}});t("column()",function(a,b){return gb(this.columns(a,b))});var lc=function(a,b,c){var d=a.aoData,e=Fa(a,c),h=Vb(la(d,e,"anCells")),g=f([].concat.apply([],h)),k,l=a.aoColumns.length,n,m,q,u,t,v;return eb("cell",b,function(b){var c="function"===typeof b;if(null===b||b===p||c){n=[];m=0;for(q=e.length;m<q;m++)for(k=
e[m],u=0;u<l;u++)t={row:k,column:u},c?(v=d[k],b(t,I(a,k,u),v.anCells?v.anCells[u]:null)&&n.push(t)):n.push(t);return n}if(f.isPlainObject(b))return b.column!==p&&b.row!==p&&-1!==f.inArray(b.row,e)?[b]:[];c=g.filter(b).map(function(a,b){return{row:b._DT_CellIndex.row,column:b._DT_CellIndex.column}}).toArray();if(c.length||!b.nodeName)return c;v=f(b).closest("*[data-dt-row]");return v.length?[{row:v.data("dt-row"),column:v.data("dt-column")}]:[]},a,c)};t("cells()",function(a,b,c){f.isPlainObject(a)&&
(a.row===p?(c=a,a=null):(c=b,b=null));f.isPlainObject(b)&&(c=b,b=null);if(null===b||b===p)return this.iterator("table",function(b){return lc(b,a,fb(c))});var d=c?{page:c.page,order:c.order,search:c.search}:{},e=this.columns(b,d),h=this.rows(a,d),g,k,l,n;d=this.iterator("table",function(a,b){a=[];g=0;for(k=h[b].length;g<k;g++)for(l=0,n=e[b].length;l<n;l++)a.push({row:h[b][g],column:e[b][l]});return a},1);d=c&&c.selected?this.cells(d,c):d;f.extend(d.selector,{cols:b,rows:a,opts:c});return d});x("cells().nodes()",
"cell().node()",function(){return this.iterator("cell",function(a,b,c){return(a=a.aoData[b])&&a.anCells?a.anCells[c]:p},1)});t("cells().data()",function(){return this.iterator("cell",function(a,b,c){return I(a,b,c)},1)});x("cells().cache()","cell().cache()",function(a){a="search"===a?"_aFilterData":"_aSortData";return this.iterator("cell",function(b,c,d){return b.aoData[c][a][d]},1)});x("cells().render()","cell().render()",function(a){return this.iterator("cell",function(b,c,d){return I(b,c,d,a)},
1)});x("cells().indexes()","cell().index()",function(){return this.iterator("cell",function(a,b,c){return{row:b,column:c,columnVisible:ca(a,c)}},1)});x("cells().invalidate()","cell().invalidate()",function(a){return this.iterator("cell",function(b,c,d){ea(b,c,a,d)})});t("cell()",function(a,b,c){return gb(this.cells(a,b,c))});t("cell().data()",function(a){var b=this.context,c=this[0];if(a===p)return b.length&&c.length?I(b[0],c[0].row,c[0].column):p;ob(b[0],c[0].row,c[0].column,a);ea(b[0],c[0].row,
"data",c[0].column);return this});t("order()",function(a,b){var c=this.context;if(a===p)return 0!==c.length?c[0].aaSorting:p;"number"===typeof a?a=[[a,b]]:a.length&&!f.isArray(a[0])&&(a=Array.prototype.slice.call(arguments));return this.iterator("table",function(b){b.aaSorting=a.slice()})});t("order.listener()",function(a,b,c){return this.iterator("table",function(d){Qa(d,a,b,c)})});t("order.fixed()",function(a){if(!a){var b=this.context;b=b.length?b[0].aaSortingFixed:p;return f.isArray(b)?{pre:b}:
b}return this.iterator("table",function(b){b.aaSortingFixed=f.extend(!0,{},a)})});t(["columns().order()","column().order()"],function(a){var b=this;return this.iterator("table",function(c,d){var e=[];f.each(b[d],function(b,c){e.push([c,a])});c.aaSorting=e})});t("search()",function(a,b,c,d){var e=this.context;return a===p?0!==e.length?e[0].oPreviousSearch.sSearch:p:this.iterator("table",function(e){e.oFeatures.bFilter&&ia(e,f.extend({},e.oPreviousSearch,{sSearch:a+"",bRegex:null===b?!1:b,bSmart:null===
c?!0:c,bCaseInsensitive:null===d?!0:d}),1)})});x("columns().search()","column().search()",function(a,b,c,d){return this.iterator("column",function(e,h){var g=e.aoPreSearchCols;if(a===p)return g[h].sSearch;e.oFeatures.bFilter&&(f.extend(g[h],{sSearch:a+"",bRegex:null===b?!1:b,bSmart:null===c?!0:c,bCaseInsensitive:null===d?!0:d}),ia(e,e.oPreviousSearch,1))})});t("state()",function(){return this.context.length?this.context[0].oSavedState:null});t("state.clear()",function(){return this.iterator("table",
function(a){a.fnStateSaveCallback.call(a.oInstance,a,{})})});t("state.loaded()",function(){return this.context.length?this.context[0].oLoadedState:null});t("state.save()",function(){return this.iterator("table",function(a){Ba(a)})});q.versionCheck=q.fnVersionCheck=function(a){var b=q.version.split(".");a=a.split(".");for(var c,d,e=0,f=a.length;e<f;e++)if(c=parseInt(b[e],10)||0,d=parseInt(a[e],10)||0,c!==d)return c>d;return!0};q.isDataTable=q.fnIsDataTable=function(a){var b=f(a).get(0),c=!1;if(a instanceof
q.Api)return!0;f.each(q.settings,function(a,e){a=e.nScrollHead?f("table",e.nScrollHead)[0]:null;var d=e.nScrollFoot?f("table",e.nScrollFoot)[0]:null;if(e.nTable===b||a===b||d===b)c=!0});return c};q.tables=q.fnTables=function(a){var b=!1;f.isPlainObject(a)&&(b=a.api,a=a.visible);var c=f.map(q.settings,function(b){if(!a||a&&f(b.nTable).is(":visible"))return b.nTable});return b?new v(c):c};q.camelToHungarian=L;t("$()",function(a,b){b=this.rows(b).nodes();b=f(b);return f([].concat(b.filter(a).toArray(),
b.find(a).toArray()))});f.each(["on","one","off"],function(a,b){t(b+"()",function(){var a=Array.prototype.slice.call(arguments);a[0]=f.map(a[0].split(/\s/),function(a){return a.match(/\.dt\b/)?a:a+".dt"}).join(" ");var d=f(this.tables().nodes());d[b].apply(d,a);return this})});t("clear()",function(){return this.iterator("table",function(a){qa(a)})});t("settings()",function(){return new v(this.context,this.context)});t("init()",function(){var a=this.context;return a.length?a[0].oInit:null});t("data()",
function(){return this.iterator("table",function(a){return J(a.aoData,"_aData")}).flatten()});t("destroy()",function(a){a=a||!1;return this.iterator("table",function(b){var c=b.nTableWrapper.parentNode,d=b.oClasses,e=b.nTable,h=b.nTBody,g=b.nTHead,k=b.nTFoot,l=f(e);h=f(h);var n=f(b.nTableWrapper),m=f.map(b.aoData,function(a){return a.nTr}),p;b.bDestroying=!0;A(b,"aoDestroyCallback","destroy",[b]);a||(new v(b)).columns().visible(!0);n.off(".DT").find(":not(tbody *)").off(".DT");f(z).off(".DT-"+b.sInstance);
e!=g.parentNode&&(l.children("thead").detach(),l.append(g));k&&e!=k.parentNode&&(l.children("tfoot").detach(),l.append(k));b.aaSorting=[];b.aaSortingFixed=[];Aa(b);f(m).removeClass(b.asStripeClasses.join(" "));f("th, td",g).removeClass(d.sSortable+" "+d.sSortableAsc+" "+d.sSortableDesc+" "+d.sSortableNone);h.children().detach();h.append(m);g=a?"remove":"detach";l[g]();n[g]();!a&&c&&(c.insertBefore(e,b.nTableReinsertBefore),l.css("width",b.sDestroyWidth).removeClass(d.sTable),(p=b.asDestroyStripes.length)&&
h.children().each(function(a){f(this).addClass(b.asDestroyStripes[a%p])}));c=f.inArray(b,q.settings);-1!==c&&q.settings.splice(c,1)})});f.each(["column","row","cell"],function(a,b){t(b+"s().every()",function(a){var c=this.selector.opts,e=this;return this.iterator(b,function(d,f,k,l,n){a.call(e[b](f,"cell"===b?k:c,"cell"===b?c:p),f,k,l,n)})})});t("i18n()",function(a,b,c){var d=this.context[0];a=U(a)(d.oLanguage);a===p&&(a=b);c!==p&&f.isPlainObject(a)&&(a=a[c]!==p?a[c]:a._);return a.replace("%d",c)});
q.version="1.10.20";q.settings=[];q.models={};q.models.oSearch={bCaseInsensitive:!0,sSearch:"",bRegex:!1,bSmart:!0};q.models.oRow={nTr:null,anCells:null,_aData:[],_aSortData:null,_aFilterData:null,_sFilterRow:null,_sRowStripe:"",src:null,idx:-1};q.models.oColumn={idx:null,aDataSort:null,asSorting:null,bSearchable:null,bSortable:null,bVisible:null,_sManualType:null,_bAttrSrc:!1,fnCreatedCell:null,fnGetData:null,fnSetData:null,mData:null,mRender:null,nTh:null,nTf:null,sClass:null,sContentPadding:null,
sDefaultContent:null,sName:null,sSortDataType:"std",sSortingClass:null,sSortingClassJUI:null,sTitle:null,sType:null,sWidth:null,sWidthOrig:null};q.defaults={aaData:null,aaSorting:[[0,"asc"]],aaSortingFixed:[],ajax:null,aLengthMenu:[10,25,50,100],aoColumns:null,aoColumnDefs:null,aoSearchCols:[],asStripeClasses:null,bAutoWidth:!0,bDeferRender:!1,bDestroy:!1,bFilter:!0,bInfo:!0,bLengthChange:!0,bPaginate:!0,bProcessing:!1,bRetrieve:!1,bScrollCollapse:!1,bServerSide:!1,bSort:!0,bSortMulti:!0,bSortCellsTop:!1,
bSortClasses:!0,bStateSave:!1,fnCreatedRow:null,fnDrawCallback:null,fnFooterCallback:null,fnFormatNumber:function(a){return a.toString().replace(/\B(?=(\d{3})+(?!\d))/g,this.oLanguage.sThousands)},fnHeaderCallback:null,fnInfoCallback:null,fnInitComplete:null,fnPreDrawCallback:null,fnRowCallback:null,fnServerData:null,fnServerParams:null,fnStateLoadCallback:function(a){try{return JSON.parse((-1===a.iStateDuration?sessionStorage:localStorage).getItem("DataTables_"+a.sInstance+"_"+location.pathname))}catch(b){}},
fnStateLoadParams:null,fnStateLoaded:null,fnStateSaveCallback:function(a,b){try{(-1===a.iStateDuration?sessionStorage:localStorage).setItem("DataTables_"+a.sInstance+"_"+location.pathname,JSON.stringify(b))}catch(c){}},fnStateSaveParams:null,iStateDuration:7200,iDeferLoading:null,iDisplayLength:10,iDisplayStart:0,iTabIndex:0,oClasses:{},oLanguage:{oAria:{sSortAscending:": activate to sort column ascending",sSortDescending:": activate to sort column descending"},oPaginate:{sFirst:"First",sLast:"Last",
sNext:"Next",sPrevious:"Previous"},sEmptyTable:"No data available in table",sInfo:"Showing _START_ to _END_ of _TOTAL_ entries",sInfoEmpty:"Showing 0 to 0 of 0 entries",sInfoFiltered:"(filtered from _MAX_ total entries)",sInfoPostFix:"",sDecimal:"",sThousands:",",sLengthMenu:"Show _MENU_ entries",sLoadingRecords:"Loading...",sProcessing:"Processing...",sSearch:"Search:",sSearchPlaceholder:"",sUrl:"",sZeroRecords:"No matching records found"},oSearch:f.extend({},q.models.oSearch),sAjaxDataProp:"data",
sAjaxSource:null,sDom:"lfrtip",searchDelay:null,sPaginationType:"simple_numbers",sScrollX:"",sScrollXInner:"",sScrollY:"",sServerMethod:"GET",renderer:null,rowId:"DT_RowId"};H(q.defaults);q.defaults.column={aDataSort:null,iDataSort:-1,asSorting:["asc","desc"],bSearchable:!0,bSortable:!0,bVisible:!0,fnCreatedCell:null,mData:null,mRender:null,sCellType:"td",sClass:"",sContentPadding:"",sDefaultContent:null,sName:"",sSortDataType:"std",sTitle:null,sType:null,sWidth:null};H(q.defaults.column);q.models.oSettings=
{oFeatures:{bAutoWidth:null,bDeferRender:null,bFilter:null,bInfo:null,bLengthChange:null,bPaginate:null,bProcessing:null,bServerSide:null,bSort:null,bSortMulti:null,bSortClasses:null,bStateSave:null},oScroll:{bCollapse:null,iBarWidth:0,sX:null,sXInner:null,sY:null},oLanguage:{fnInfoCallback:null},oBrowser:{bScrollOversize:!1,bScrollbarLeft:!1,bBounding:!1,barWidth:0},ajax:null,aanFeatures:[],aoData:[],aiDisplay:[],aiDisplayMaster:[],aIds:{},aoColumns:[],aoHeader:[],aoFooter:[],oPreviousSearch:{},
aoPreSearchCols:[],aaSorting:null,aaSortingFixed:[],asStripeClasses:null,asDestroyStripes:[],sDestroyWidth:0,aoRowCallback:[],aoHeaderCallback:[],aoFooterCallback:[],aoDrawCallback:[],aoRowCreatedCallback:[],aoPreDrawCallback:[],aoInitComplete:[],aoStateSaveParams:[],aoStateLoadParams:[],aoStateLoaded:[],sTableId:"",nTable:null,nTHead:null,nTFoot:null,nTBody:null,nTableWrapper:null,bDeferLoading:!1,bInitialised:!1,aoOpenRows:[],sDom:null,searchDelay:null,sPaginationType:"two_button",iStateDuration:0,
aoStateSave:[],aoStateLoad:[],oSavedState:null,oLoadedState:null,sAjaxSource:null,sAjaxDataProp:null,bAjaxDataGet:!0,jqXHR:null,json:p,oAjaxData:p,fnServerData:null,aoServerParams:[],sServerMethod:null,fnFormatNumber:null,aLengthMenu:null,iDraw:0,bDrawing:!1,iDrawError:-1,_iDisplayLength:10,_iDisplayStart:0,_iRecordsTotal:0,_iRecordsDisplay:0,oClasses:{},bFiltered:!1,bSorted:!1,bSortCellsTop:null,oInit:null,aoDestroyCallback:[],fnRecordsTotal:function(){return"ssp"==D(this)?1*this._iRecordsTotal:
this.aiDisplayMaster.length},fnRecordsDisplay:function(){return"ssp"==D(this)?1*this._iRecordsDisplay:this.aiDisplay.length},fnDisplayEnd:function(){var a=this._iDisplayLength,b=this._iDisplayStart,c=b+a,d=this.aiDisplay.length,e=this.oFeatures,f=e.bPaginate;return e.bServerSide?!1===f||-1===a?b+d:Math.min(b+a,this._iRecordsDisplay):!f||c>d||-1===a?d:c},oInstance:null,sInstance:null,iTabIndex:0,nScrollHead:null,nScrollFoot:null,aLastSort:[],oPlugins:{},rowIdFn:null,rowId:null};q.ext=C={buttons:{},
classes:{},builder:"-source-",errMode:"alert",feature:[],search:[],selector:{cell:[],column:[],row:[]},internal:{},legacy:{ajax:null},pager:{},renderer:{pageButton:{},header:{}},order:{},type:{detect:[],search:{},order:{}},_unique:0,fnVersionCheck:q.fnVersionCheck,iApiIndex:0,oJUIClasses:{},sVersion:q.version};f.extend(C,{afnFiltering:C.search,aTypes:C.type.detect,ofnSearch:C.type.search,oSort:C.type.order,afnSortData:C.order,aoFeatures:C.feature,oApi:C.internal,oStdClasses:C.classes,oPagination:C.pager});
f.extend(q.ext.classes,{sTable:"dataTable",sNoFooter:"no-footer",sPageButton:"paginate_button",sPageButtonActive:"current",sPageButtonDisabled:"disabled",sStripeOdd:"odd",sStripeEven:"even",sRowEmpty:"dataTables_empty",sWrapper:"dataTables_wrapper",sFilter:"dataTables_filter",sInfo:"dataTables_info",sPaging:"dataTables_paginate paging_",sLength:"dataTables_length",sProcessing:"dataTables_processing",sSortAsc:"sorting_asc",sSortDesc:"sorting_desc",sSortable:"sorting",sSortableAsc:"sorting_asc_disabled",
sSortableDesc:"sorting_desc_disabled",sSortableNone:"sorting_disabled",sSortColumn:"sorting_",sFilterInput:"",sLengthSelect:"",sScrollWrapper:"dataTables_scroll",sScrollHead:"dataTables_scrollHead",sScrollHeadInner:"dataTables_scrollHeadInner",sScrollBody:"dataTables_scrollBody",sScrollFoot:"dataTables_scrollFoot",sScrollFootInner:"dataTables_scrollFootInner",sHeaderTH:"",sFooterTH:"",sSortJUIAsc:"",sSortJUIDesc:"",sSortJUI:"",sSortJUIAscAllowed:"",sSortJUIDescAllowed:"",sSortJUIWrapper:"",sSortIcon:"",
sJUIHeader:"",sJUIFooter:""});var Pb=q.ext.pager;f.extend(Pb,{simple:function(a,b){return["previous","next"]},full:function(a,b){return["first","previous","next","last"]},numbers:function(a,b){return[ka(a,b)]},simple_numbers:function(a,b){return["previous",ka(a,b),"next"]},full_numbers:function(a,b){return["first","previous",ka(a,b),"next","last"]},first_last_numbers:function(a,b){return["first",ka(a,b),"last"]},_numbers:ka,numbers_length:7});f.extend(!0,q.ext.renderer,{pageButton:{_:function(a,b,
c,d,e,h){var g=a.oClasses,k=a.oLanguage.oPaginate,l=a.oLanguage.oAria.paginate||{},n,m,q=0,t=function(b,d){var p,r=g.sPageButtonDisabled,u=function(b){Xa(a,b.data.action,!0)};var w=0;for(p=d.length;w<p;w++){var v=d[w];if(f.isArray(v)){var x=f("<"+(v.DT_el||"div")+"/>").appendTo(b);t(x,v)}else{n=null;m=v;x=a.iTabIndex;switch(v){case "ellipsis":b.append('<span class="ellipsis">&#x2026;</span>');break;case "first":n=k.sFirst;0===e&&(x=-1,m+=" "+r);break;case "previous":n=k.sPrevious;0===e&&(x=-1,m+=
" "+r);break;case "next":n=k.sNext;e===h-1&&(x=-1,m+=" "+r);break;case "last":n=k.sLast;e===h-1&&(x=-1,m+=" "+r);break;default:n=v+1,m=e===v?g.sPageButtonActive:""}null!==n&&(x=f("<a>",{"class":g.sPageButton+" "+m,"aria-controls":a.sTableId,"aria-label":l[v],"data-dt-idx":q,tabindex:x,id:0===c&&"string"===typeof v?a.sTableId+"_"+v:null}).html(n).appendTo(b),$a(x,{action:v},u),q++)}}};try{var v=f(b).find(y.activeElement).data("dt-idx")}catch(mc){}t(f(b).empty(),d);v!==p&&f(b).find("[data-dt-idx="+
v+"]").focus()}}});f.extend(q.ext.type.detect,[function(a,b){b=b.oLanguage.sDecimal;return db(a,b)?"num"+b:null},function(a,b){if(a&&!(a instanceof Date)&&!cc.test(a))return null;b=Date.parse(a);return null!==b&&!isNaN(b)||P(a)?"date":null},function(a,b){b=b.oLanguage.sDecimal;return db(a,b,!0)?"num-fmt"+b:null},function(a,b){b=b.oLanguage.sDecimal;return Ub(a,b)?"html-num"+b:null},function(a,b){b=b.oLanguage.sDecimal;return Ub(a,b,!0)?"html-num-fmt"+b:null},function(a,b){return P(a)||"string"===
typeof a&&-1!==a.indexOf("<")?"html":null}]);f.extend(q.ext.type.search,{html:function(a){return P(a)?a:"string"===typeof a?a.replace(Rb," ").replace(Ea,""):""},string:function(a){return P(a)?a:"string"===typeof a?a.replace(Rb," "):a}});var Da=function(a,b,c,d){if(0!==a&&(!a||"-"===a))return-Infinity;b&&(a=Tb(a,b));a.replace&&(c&&(a=a.replace(c,"")),d&&(a=a.replace(d,"")));return 1*a};f.extend(C.type.order,{"date-pre":function(a){a=Date.parse(a);return isNaN(a)?-Infinity:a},"html-pre":function(a){return P(a)?
"":a.replace?a.replace(/<.*?>/g,"").toLowerCase():a+""},"string-pre":function(a){return P(a)?"":"string"===typeof a?a.toLowerCase():a.toString?a.toString():""},"string-asc":function(a,b){return a<b?-1:a>b?1:0},"string-desc":function(a,b){return a<b?1:a>b?-1:0}});Ha("");f.extend(!0,q.ext.renderer,{header:{_:function(a,b,c,d){f(a.nTable).on("order.dt.DT",function(e,f,g,k){a===f&&(e=c.idx,b.removeClass(c.sSortingClass+" "+d.sSortAsc+" "+d.sSortDesc).addClass("asc"==k[e]?d.sSortAsc:"desc"==k[e]?d.sSortDesc:
c.sSortingClass))})},jqueryui:function(a,b,c,d){f("<div/>").addClass(d.sSortJUIWrapper).append(b.contents()).append(f("<span/>").addClass(d.sSortIcon+" "+c.sSortingClassJUI)).appendTo(b);f(a.nTable).on("order.dt.DT",function(e,f,g,k){a===f&&(e=c.idx,b.removeClass(d.sSortAsc+" "+d.sSortDesc).addClass("asc"==k[e]?d.sSortAsc:"desc"==k[e]?d.sSortDesc:c.sSortingClass),b.find("span."+d.sSortIcon).removeClass(d.sSortJUIAsc+" "+d.sSortJUIDesc+" "+d.sSortJUI+" "+d.sSortJUIAscAllowed+" "+d.sSortJUIDescAllowed).addClass("asc"==
k[e]?d.sSortJUIAsc:"desc"==k[e]?d.sSortJUIDesc:c.sSortingClassJUI))})}}});var ib=function(a){return"string"===typeof a?a.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"):a};q.render={number:function(a,b,c,d,e){return{display:function(f){if("number"!==typeof f&&"string"!==typeof f)return f;var g=0>f?"-":"",h=parseFloat(f);if(isNaN(h))return ib(f);h=h.toFixed(c);f=Math.abs(h);h=parseInt(f,10);f=c?b+(f-h).toFixed(c).substring(2):"";return g+(d||"")+h.toString().replace(/\B(?=(\d{3})+(?!\d))/g,
a)+f+(e||"")}}},text:function(){return{display:ib,filter:ib}}};f.extend(q.ext.internal,{_fnExternApiFunc:Qb,_fnBuildAjax:va,_fnAjaxUpdate:qb,_fnAjaxParameters:zb,_fnAjaxUpdateDraw:Ab,_fnAjaxDataSrc:wa,_fnAddColumn:Ia,_fnColumnOptions:ma,_fnAdjustColumnSizing:aa,_fnVisibleToColumnIndex:ba,_fnColumnIndexToVisible:ca,_fnVisbleColumns:W,_fnGetColumns:oa,_fnColumnTypes:Ka,_fnApplyColumnDefs:nb,_fnHungarianMap:H,_fnCamelToHungarian:L,_fnLanguageCompat:Ga,_fnBrowserDetect:lb,_fnAddData:R,_fnAddTr:pa,_fnNodeToDataIndex:function(a,
b){return b._DT_RowIndex!==p?b._DT_RowIndex:null},_fnNodeToColumnIndex:function(a,b,c){return f.inArray(c,a.aoData[b].anCells)},_fnGetCellData:I,_fnSetCellData:ob,_fnSplitObjNotation:Na,_fnGetObjectDataFn:U,_fnSetObjectDataFn:Q,_fnGetDataMaster:Oa,_fnClearTable:qa,_fnDeleteIndex:ra,_fnInvalidate:ea,_fnGetRowElements:Ma,_fnCreateTr:La,_fnBuildHead:pb,_fnDrawHead:ha,_fnDraw:S,_fnReDraw:V,_fnAddOptionsHtml:sb,_fnDetectHeader:fa,_fnGetUniqueThs:ua,_fnFeatureHtmlFilter:ub,_fnFilterComplete:ia,_fnFilterCustom:Db,
_fnFilterColumn:Cb,_fnFilter:Bb,_fnFilterCreateSearch:Ta,_fnEscapeRegex:Ua,_fnFilterData:Eb,_fnFeatureHtmlInfo:xb,_fnUpdateInfo:Hb,_fnInfoMacros:Ib,_fnInitialise:ja,_fnInitComplete:xa,_fnLengthChange:Va,_fnFeatureHtmlLength:tb,_fnFeatureHtmlPaginate:yb,_fnPageChange:Xa,_fnFeatureHtmlProcessing:vb,_fnProcessingDisplay:K,_fnFeatureHtmlTable:wb,_fnScrollDraw:na,_fnApplyToChildren:N,_fnCalculateColumnWidths:Ja,_fnThrottle:Sa,_fnConvertToWidth:Jb,_fnGetWidestNode:Kb,_fnGetMaxLenString:Lb,_fnStringToCss:B,
_fnSortFlatten:Y,_fnSort:rb,_fnSortAria:Nb,_fnSortListener:Za,_fnSortAttachListener:Qa,_fnSortingClasses:Aa,_fnSortData:Mb,_fnSaveState:Ba,_fnLoadState:Ob,_fnSettingsFromNode:Ca,_fnLog:O,_fnMap:M,_fnBindAction:$a,_fnCallbackReg:E,_fnCallbackFire:A,_fnLengthOverflow:Wa,_fnRenderer:Ra,_fnDataSource:D,_fnRowAttributes:Pa,_fnExtend:ab,_fnCalculateEnd:function(){}});f.fn.dataTable=q;q.$=f;f.fn.dataTableSettings=q.settings;f.fn.dataTableExt=q.ext;f.fn.DataTable=function(a){return f(this).dataTable(a).api()};
f.each(q,function(a,b){f.fn.DataTable[a]=b});return f.fn.dataTable});

/*!
   Copyright 2010-2018 SpryMedia Ltd.

 This source file is free software, available under the following license:
   MIT license - http://datatables.net/license/mit

 This source file is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 or FITNESS FOR A PARTICULAR PURPOSE. See the license files for details.

 For details please refer to: http://www.datatables.net
 FixedColumns 3.3.0
 ©2010-2018 SpryMedia Ltd - datatables.net/license
*/
var $jscomp=$jscomp||{};$jscomp.scope={};$jscomp.findInternal=function(c,g,e){c instanceof String&&(c=String(c));for(var q=c.length,l=0;l<q;l++){var u=c[l];if(g.call(e,u,l,c))return{i:l,v:u}}return{i:-1,v:void 0}};$jscomp.ASSUME_ES5=!1;$jscomp.ASSUME_NO_NATIVE_MAP=!1;$jscomp.ASSUME_NO_NATIVE_SET=!1;$jscomp.SIMPLE_FROUND_POLYFILL=!1;
$jscomp.defineProperty=$jscomp.ASSUME_ES5||"function"==typeof Object.defineProperties?Object.defineProperty:function(c,g,e){c!=Array.prototype&&c!=Object.prototype&&(c[g]=e.value)};$jscomp.getGlobal=function(c){return"undefined"!=typeof window&&window===c?c:"undefined"!=typeof global&&null!=global?global:c};$jscomp.global=$jscomp.getGlobal(this);
$jscomp.polyfill=function(c,g,e,q){if(g){e=$jscomp.global;c=c.split(".");for(q=0;q<c.length-1;q++){var l=c[q];l in e||(e[l]={});e=e[l]}c=c[c.length-1];q=e[c];g=g(q);g!=q&&null!=g&&$jscomp.defineProperty(e,c,{configurable:!0,writable:!0,value:g})}};$jscomp.polyfill("Array.prototype.find",function(c){return c?c:function(c,e){return $jscomp.findInternal(this,c,e).v}},"es6","es3");
(function(c){"function"===typeof define&&define.amd?define(["jquery","datatables.net"],function(g){return c(g,window,document)}):"object"===typeof exports?module.exports=function(g,e){g||(g=window);e&&e.fn.dataTable||(e=require("datatables.net")(g,e).$);return c(e,g,g.document)}:c(jQuery,window,document)})(function(c,g,e,q){var l=c.fn.dataTable,u,p=function(a,b){var d=this;if(this instanceof p){if(b===q||!0===b)b={};var h=c.fn.dataTable.camelToHungarian;h&&(h(p.defaults,p.defaults,!0),h(p.defaults,
b));a=(new c.fn.dataTable.Api(a)).settings()[0];this.s={dt:a,iTableColumns:a.aoColumns.length,aiOuterWidths:[],aiInnerWidths:[],rtl:"rtl"===c(a.nTable).css("direction")};this.dom={scroller:null,header:null,body:null,footer:null,grid:{wrapper:null,dt:null,left:{wrapper:null,head:null,body:null,foot:null},right:{wrapper:null,head:null,body:null,foot:null}},clone:{left:{header:null,body:null,footer:null},right:{header:null,body:null,footer:null}}};if(a._oFixedColumns)throw"FixedColumns already initialised on this table";
a._oFixedColumns=this;a._bInitComplete?this._fnConstruct(b):a.oApi._fnCallbackReg(a,"aoInitComplete",function(){d._fnConstruct(b)},"FixedColumns")}else alert("FixedColumns warning: FixedColumns must be initialised with the 'new' keyword.")};c.extend(p.prototype,{fnUpdate:function(){this._fnDraw(!0)},fnRedrawLayout:function(){this._fnColCalc();this._fnGridLayout();this.fnUpdate()},fnRecalculateHeight:function(a){delete a._DTTC_iHeight;a.style.height="auto"},fnSetRowHeight:function(a,b){a.style.height=
b+"px"},fnGetPosition:function(a){var b=this.s.dt.oInstance;if(c(a).parents(".DTFC_Cloned").length){if("tr"===a.nodeName.toLowerCase())return a=c(a).index(),b.fnGetPosition(c("tr",this.s.dt.nTBody)[a]);var d=c(a).index();a=c(a.parentNode).index();return[b.fnGetPosition(c("tr",this.s.dt.nTBody)[a]),d,b.oApi._fnVisibleToColumnIndex(this.s.dt,d)]}return b.fnGetPosition(a)},fnToFixedNode:function(a,b){var d;b<this.s.iLeftColumns?d=c(this.dom.clone.left.body).find("[data-dt-row="+a+"][data-dt-column="+
b+"]"):b>=this.s.iRightColumns&&(d=c(this.dom.clone.right.body).find("[data-dt-row="+a+"][data-dt-column="+b+"]"));return d&&d.length?d[0]:(new c.fn.dataTable.Api(this.s.dt)).cell(a,b).node()},_fnConstruct:function(a){var b=this;if("function"!=typeof this.s.dt.oInstance.fnVersionCheck||!0!==this.s.dt.oInstance.fnVersionCheck("1.8.0"))alert("FixedColumns "+p.VERSION+" required DataTables 1.8.0 or later. Please upgrade your DataTables installation");else if(""===this.s.dt.oScroll.sX)this.s.dt.oInstance.oApi._fnLog(this.s.dt,
1,"FixedColumns is not needed (no x-scrolling in DataTables enabled), so no action will be taken. Use 'FixedHeader' for column fixing when scrolling is not enabled");else{this.s=c.extend(!0,this.s,p.defaults,a);a=this.s.dt.oClasses;this.dom.grid.dt=c(this.s.dt.nTable).parents("div."+a.sScrollWrapper)[0];this.dom.scroller=c("div."+a.sScrollBody,this.dom.grid.dt)[0];this._fnColCalc();this._fnGridSetup();var d,h=!1;c(this.s.dt.nTableWrapper).on("mousedown.DTFC",function(a){0===a.button&&(h=!0,c(e).one("mouseup",
function(){h=!1}))});c(this.dom.scroller).on("mouseover.DTFC touchstart.DTFC",function(){h||(d="main")}).on("scroll.DTFC",function(a){!d&&a.originalEvent&&(d="main");"main"===d&&(0<b.s.iLeftColumns&&(b.dom.grid.left.liner.scrollTop=b.dom.scroller.scrollTop),0<b.s.iRightColumns&&(b.dom.grid.right.liner.scrollTop=b.dom.scroller.scrollTop))});var f="onwheel"in e.createElement("div")?"wheel.DTFC":"mousewheel.DTFC";if(0<b.s.iLeftColumns)c(b.dom.grid.left.liner).on("mouseover.DTFC touchstart.DTFC",function(){h||
(d="left")}).on("scroll.DTFC",function(a){!d&&a.originalEvent&&(d="left");"left"===d&&(b.dom.scroller.scrollTop=b.dom.grid.left.liner.scrollTop,0<b.s.iRightColumns&&(b.dom.grid.right.liner.scrollTop=b.dom.grid.left.liner.scrollTop))}).on(f,function(a){b.dom.scroller.scrollLeft-="wheel"===a.type?-a.originalEvent.deltaX:a.originalEvent.wheelDeltaX});if(0<b.s.iRightColumns)c(b.dom.grid.right.liner).on("mouseover.DTFC touchstart.DTFC",function(){h||(d="right")}).on("scroll.DTFC",function(a){!d&&a.originalEvent&&
(d="right");"right"===d&&(b.dom.scroller.scrollTop=b.dom.grid.right.liner.scrollTop,0<b.s.iLeftColumns&&(b.dom.grid.left.liner.scrollTop=b.dom.grid.right.liner.scrollTop))}).on(f,function(a){b.dom.scroller.scrollLeft-="wheel"===a.type?-a.originalEvent.deltaX:a.originalEvent.wheelDeltaX});c(g).on("resize.DTFC",function(){b._fnGridLayout.call(b)});var m=!0,k=c(this.s.dt.nTable);k.on("draw.dt.DTFC",function(){b._fnColCalc();b._fnDraw.call(b,m);m=!1}).on("column-sizing.dt.DTFC",function(){b._fnColCalc();
b._fnGridLayout(b)}).on("column-visibility.dt.DTFC",function(a,c,d,f,h){if(h===q||h)b._fnColCalc(),b._fnGridLayout(b),b._fnDraw(!0)}).on("select.dt.DTFC deselect.dt.DTFC",function(a,c,d,f){"dt"===a.namespace&&b._fnDraw(!1)}).on("destroy.dt.DTFC",function(){k.off(".DTFC");c(b.dom.scroller).off(".DTFC");c(g).off(".DTFC");c(b.s.dt.nTableWrapper).off(".DTFC");c(b.dom.grid.left.liner).off(".DTFC "+f);c(b.dom.grid.left.wrapper).remove();c(b.dom.grid.right.liner).off(".DTFC "+f);c(b.dom.grid.right.wrapper).remove()});
this._fnGridLayout();this.s.dt.oInstance.fnDraw(!1)}},_fnColCalc:function(){var a=this,b=0,d=0;this.s.aiInnerWidths=[];this.s.aiOuterWidths=[];c.each(this.s.dt.aoColumns,function(h,f){f=c(f.nTh);if(f.filter(":visible").length){var m=f.outerWidth();if(0===a.s.aiOuterWidths.length){var k=c(a.s.dt.nTable).css("border-left-width");m+="string"===typeof k&&-1===k.indexOf("px")?1:parseInt(k,10)}a.s.aiOuterWidths.length===a.s.dt.aoColumns.length-1&&(k=c(a.s.dt.nTable).css("border-right-width"),m+="string"===
typeof k&&-1===k.indexOf("px")?1:parseInt(k,10));a.s.aiOuterWidths.push(m);a.s.aiInnerWidths.push(f.width());h<a.s.iLeftColumns&&(b+=m);a.s.iTableColumns-a.s.iRightColumns<=h&&(d+=m)}else a.s.aiInnerWidths.push(0),a.s.aiOuterWidths.push(0)});this.s.iLeftWidth=b;this.s.iRightWidth=d},_fnGridSetup:function(){var a=this._fnDTOverflow();this.dom.body=this.s.dt.nTable;this.dom.header=this.s.dt.nTHead.parentNode;this.dom.header.parentNode.parentNode.style.position="relative";var b=c('<div class="DTFC_ScrollWrapper" style="position:relative; clear:both;"><div class="DTFC_LeftWrapper" style="position:absolute; top:0; left:0;" aria-hidden="true"><div class="DTFC_LeftHeadWrapper" style="position:relative; top:0; left:0; overflow:hidden;"></div><div class="DTFC_LeftBodyWrapper" style="position:relative; top:0; left:0; height:0; overflow:hidden;"><div class="DTFC_LeftBodyLiner" style="position:relative; top:0; left:0; overflow-y:scroll;"></div></div><div class="DTFC_LeftFootWrapper" style="position:relative; top:0; left:0; overflow:hidden;"></div></div><div class="DTFC_RightWrapper" style="position:absolute; top:0; right:0;" aria-hidden="true"><div class="DTFC_RightHeadWrapper" style="position:relative; top:0; left:0;"><div class="DTFC_RightHeadBlocker DTFC_Blocker" style="position:absolute; top:0; bottom:0;"></div></div><div class="DTFC_RightBodyWrapper" style="position:relative; top:0; left:0; height:0; overflow:hidden;"><div class="DTFC_RightBodyLiner" style="position:relative; top:0; left:0; overflow-y:scroll;"></div></div><div class="DTFC_RightFootWrapper" style="position:relative; top:0; left:0;"><div class="DTFC_RightFootBlocker DTFC_Blocker" style="position:absolute; top:0; bottom:0;"></div></div></div></div>')[0],
d=b.childNodes[0],h=b.childNodes[1];this.dom.grid.dt.parentNode.insertBefore(b,this.dom.grid.dt);b.appendChild(this.dom.grid.dt);this.dom.grid.wrapper=b;0<this.s.iLeftColumns&&(this.dom.grid.left.wrapper=d,this.dom.grid.left.head=d.childNodes[0],this.dom.grid.left.body=d.childNodes[1],this.dom.grid.left.liner=c("div.DTFC_LeftBodyLiner",b)[0],b.appendChild(d));if(0<this.s.iRightColumns){this.dom.grid.right.wrapper=h;this.dom.grid.right.head=h.childNodes[0];this.dom.grid.right.body=h.childNodes[1];
this.dom.grid.right.liner=c("div.DTFC_RightBodyLiner",b)[0];h.style.right=a.bar+"px";var f=c("div.DTFC_RightHeadBlocker",b)[0];f.style.width=a.bar+"px";f.style.right=-a.bar+"px";this.dom.grid.right.headBlock=f;f=c("div.DTFC_RightFootBlocker",b)[0];f.style.width=a.bar+"px";f.style.right=-a.bar+"px";this.dom.grid.right.footBlock=f;b.appendChild(h)}this.s.dt.nTFoot&&(this.dom.footer=this.s.dt.nTFoot.parentNode,0<this.s.iLeftColumns&&(this.dom.grid.left.foot=d.childNodes[2]),0<this.s.iRightColumns&&(this.dom.grid.right.foot=
h.childNodes[2]));this.s.rtl&&c("div.DTFC_RightHeadBlocker",b).css({left:-a.bar+"px",right:""})},_fnGridLayout:function(){var a=this,b=this.dom.grid;c(b.wrapper).width();var d=this.s.dt.nTable.parentNode.offsetHeight,h=this.s.dt.nTable.parentNode.parentNode.offsetHeight,f=this._fnDTOverflow(),m=this.s.iLeftWidth,k=this.s.iRightWidth,x="rtl"===c(this.dom.body).css("direction"),w=function(b,d){f.bar?a._firefoxScrollError()?34<c(b).height()&&(b.style.width=d+f.bar+"px"):b.style.width=d+f.bar+"px":(b.style.width=
d+20+"px",b.style.paddingRight="20px",b.style.boxSizing="border-box")};f.x&&(d-=f.bar);b.wrapper.style.height=h+"px";0<this.s.iLeftColumns&&(h=b.left.wrapper,h.style.width=m+"px",h.style.height="1px",x?(h.style.left="",h.style.right=0):(h.style.left=0,h.style.right=""),b.left.body.style.height=d+"px",b.left.foot&&(b.left.foot.style.top=(f.x?f.bar:0)+"px"),w(b.left.liner,m),b.left.liner.style.height=d+"px",b.left.liner.style.maxHeight=d+"px");0<this.s.iRightColumns&&(h=b.right.wrapper,h.style.width=
k+"px",h.style.height="1px",this.s.rtl?(h.style.left=f.y?f.bar+"px":0,h.style.right=""):(h.style.left="",h.style.right=f.y?f.bar+"px":0),b.right.body.style.height=d+"px",b.right.foot&&(b.right.foot.style.top=(f.x?f.bar:0)+"px"),w(b.right.liner,k),b.right.liner.style.height=d+"px",b.right.liner.style.maxHeight=d+"px",b.right.headBlock.style.display=f.y?"block":"none",b.right.footBlock.style.display=f.y?"block":"none")},_fnDTOverflow:function(){var a=this.s.dt.nTable,b=a.parentNode,c={x:!1,y:!1,bar:this.s.dt.oScroll.iBarWidth};
a.offsetWidth>b.clientWidth&&(c.x=!0);a.offsetHeight>b.clientHeight&&(c.y=!0);return c},_fnDraw:function(a){this._fnGridLayout();this._fnCloneLeft(a);this._fnCloneRight(a);null!==this.s.fnDrawCallback&&this.s.fnDrawCallback.call(this,this.dom.clone.left,this.dom.clone.right);c(this).trigger("draw.dtfc",{leftClone:this.dom.clone.left,rightClone:this.dom.clone.right})},_fnCloneRight:function(a){if(!(0>=this.s.iRightColumns)){var b,c=[];for(b=this.s.iTableColumns-this.s.iRightColumns;b<this.s.iTableColumns;b++)this.s.dt.aoColumns[b].bVisible&&
c.push(b);this._fnClone(this.dom.clone.right,this.dom.grid.right,c,a)}},_fnCloneLeft:function(a){if(!(0>=this.s.iLeftColumns)){var b,c=[];for(b=0;b<this.s.iLeftColumns;b++)this.s.dt.aoColumns[b].bVisible&&c.push(b);this._fnClone(this.dom.clone.left,this.dom.grid.left,c,a)}},_fnCopyLayout:function(a,b,d){for(var h=[],f=[],m=[],k=0,x=a.length;k<x;k++){var w=[];w.nTr=c(a[k].nTr).clone(d,!1)[0];for(var e=0,n=this.s.iTableColumns;e<n;e++)if(-1!==c.inArray(e,b)){var g=c.inArray(a[k][e].cell,m);-1===g?(g=
c(a[k][e].cell).clone(d,!1)[0],f.push(g),m.push(a[k][e].cell),w.push({cell:g,unique:a[k][e].unique})):w.push({cell:f[g],unique:a[k][e].unique})}h.push(w)}return h},_fnClone:function(a,b,d,h){var f=this,m,k,e=this.s.dt;if(h){c(a.header).remove();a.header=c(this.dom.header).clone(!0,!1)[0];a.header.className+=" DTFC_Cloned";a.header.style.width="100%";b.head.appendChild(a.header);var g=this._fnCopyLayout(e.aoHeader,d,!0);var l=c(">thead",a.header);l.empty();var n=0;for(m=g.length;n<m;n++)l[0].appendChild(g[n].nTr);
e.oApi._fnDrawHead(e,g,!0)}else{g=this._fnCopyLayout(e.aoHeader,d,!1);var p=[];e.oApi._fnDetectHeader(p,c(">thead",a.header)[0]);n=0;for(m=g.length;n<m;n++){var t=0;for(l=g[n].length;t<l;t++)p[n][t].cell.className=g[n][t].cell.className,c("span.DataTables_sort_icon",p[n][t].cell).each(function(){this.className=c("span.DataTables_sort_icon",g[n][t].cell)[0].className})}}this._fnEqualiseHeights("thead",this.dom.header,a.header);"auto"==this.s.sHeightMatch&&c(">tbody>tr",f.dom.body).css("height","auto");
null!==a.body&&(c(a.body).remove(),a.body=null);a.body=c(this.dom.body).clone(!0)[0];a.body.className+=" DTFC_Cloned";a.body.style.paddingBottom=e.oScroll.iBarWidth+"px";a.body.style.marginBottom=2*e.oScroll.iBarWidth+"px";null!==a.body.getAttribute("id")&&a.body.removeAttribute("id");c(">thead>tr",a.body).empty();c(">tfoot",a.body).remove();var u=c("tbody",a.body)[0];c(u).empty();if(0<e.aiDisplay.length){m=c(">thead>tr",a.body)[0];for(k=0;k<d.length;k++){var v=d[k];var r=c(e.aoColumns[v].nTh).clone(!0)[0];
r.innerHTML="";l=r.style;l.paddingTop="0";l.paddingBottom="0";l.borderTopWidth="0";l.borderBottomWidth="0";l.height=0;l.width=f.s.aiInnerWidths[v]+"px";m.appendChild(r)}c(">tbody>tr",f.dom.body).each(function(a){a=!1===f.s.dt.oFeatures.bServerSide?f.s.dt.aiDisplay[f.s.dt._iDisplayStart+a]:a;var b=f.s.dt.aoData[a].anCells||c(this).children("td, th"),e=this.cloneNode(!1);e.removeAttribute("id");e.setAttribute("data-dt-row",a);for(k=0;k<d.length;k++)v=d[k],0<b.length&&(r=c(b[v]).clone(!0,!0)[0],r.removeAttribute("id"),
r.setAttribute("data-dt-row",a),r.setAttribute("data-dt-column",v),e.appendChild(r));u.appendChild(e)})}else c(">tbody>tr",f.dom.body).each(function(a){r=this.cloneNode(!0);r.className+=" DTFC_NoData";c("td",r).html("");u.appendChild(r)});a.body.style.width="100%";a.body.style.margin="0";a.body.style.padding="0";e.oScroller!==q&&(m=e.oScroller.dom.force,b.forcer?b.forcer.style.height=m.style.height:(b.forcer=m.cloneNode(!0),b.liner.appendChild(b.forcer)));b.liner.appendChild(a.body);this._fnEqualiseHeights("tbody",
f.dom.body,a.body);if(null!==e.nTFoot){if(h){null!==a.footer&&a.footer.parentNode.removeChild(a.footer);a.footer=c(this.dom.footer).clone(!0,!0)[0];a.footer.className+=" DTFC_Cloned";a.footer.style.width="100%";b.foot.appendChild(a.footer);g=this._fnCopyLayout(e.aoFooter,d,!0);b=c(">tfoot",a.footer);b.empty();n=0;for(m=g.length;n<m;n++)b[0].appendChild(g[n].nTr);e.oApi._fnDrawHead(e,g,!0)}else for(g=this._fnCopyLayout(e.aoFooter,d,!1),b=[],e.oApi._fnDetectHeader(b,c(">tfoot",a.footer)[0]),n=0,m=g.length;n<
m;n++)for(t=0,l=g[n].length;t<l;t++)b[n][t].cell.className=g[n][t].cell.className;this._fnEqualiseHeights("tfoot",this.dom.footer,a.footer)}b=e.oApi._fnGetUniqueThs(e,c(">thead",a.header)[0]);c(b).each(function(a){v=d[a];this.style.width=f.s.aiInnerWidths[v]+"px"});null!==f.s.dt.nTFoot&&(b=e.oApi._fnGetUniqueThs(e,c(">tfoot",a.footer)[0]),c(b).each(function(a){v=d[a];this.style.width=f.s.aiInnerWidths[v]+"px"}))},_fnGetTrNodes:function(a){for(var b=[],c=0,e=a.childNodes.length;c<e;c++)"TR"==a.childNodes[c].nodeName.toUpperCase()&&
b.push(a.childNodes[c]);return b},_fnEqualiseHeights:function(a,b,d){if("none"!=this.s.sHeightMatch||"thead"===a||"tfoot"===a){var e=b.getElementsByTagName(a)[0];d=d.getElementsByTagName(a)[0];a=c(">"+a+">tr:eq(0)",b).children(":first");a.outerHeight();a.height();e=this._fnGetTrNodes(e);b=this._fnGetTrNodes(d);var f=[];d=0;for(a=b.length;d<a;d++){var g=e[d].offsetHeight;var k=b[d].offsetHeight;g=k>g?k:g;"semiauto"==this.s.sHeightMatch&&(e[d]._DTTC_iHeight=g);f.push(g)}d=0;for(a=b.length;d<a;d++)b[d].style.height=
f[d]+"px",e[d].style.height=f[d]+"px"}},_firefoxScrollError:function(){if(u===q){var a=c("<div/>").css({position:"absolute",top:0,left:0,height:10,width:50,overflow:"scroll"}).appendTo("body");u=a[0].clientWidth===a[0].offsetWidth&&0!==this._fnDTOverflow().bar;a.remove()}return u}});p.defaults={iLeftColumns:1,iRightColumns:0,fnDrawCallback:null,sHeightMatch:"semiauto"};p.version="3.3.0";l.Api.register("fixedColumns()",function(){return this});l.Api.register("fixedColumns().update()",function(){return this.iterator("table",
function(a){a._oFixedColumns&&a._oFixedColumns.fnUpdate()})});l.Api.register("fixedColumns().relayout()",function(){return this.iterator("table",function(a){a._oFixedColumns&&a._oFixedColumns.fnRedrawLayout()})});l.Api.register("rows().recalcHeight()",function(){return this.iterator("row",function(a,b){a._oFixedColumns&&a._oFixedColumns.fnRecalculateHeight(this.row(b).node())})});l.Api.register("fixedColumns().rowIndex()",function(a){a=c(a);return a.parents(".DTFC_Cloned").length?this.rows({page:"current"}).indexes()[a.index()]:
this.row(a).index()});l.Api.register("fixedColumns().cellIndex()",function(a){a=c(a);if(a.parents(".DTFC_Cloned").length){var b=a.parent().index();b=this.rows({page:"current"}).indexes()[b];a=a.parents(".DTFC_LeftWrapper").length?a.index():this.columns().flatten().length-this.context[0]._oFixedColumns.s.iRightColumns+a.index();return{row:b,column:this.column.index("toData",a),columnVisible:a}}return this.cell(a).index()});l.Api.registerPlural("cells().fixedNodes()","cell().fixedNode()",function(){return this.iterator("cell",
function(a,b,c){return a._oFixedColumns?a._oFixedColumns.fnToFixedNode(b,c):this.node()},1)});c(e).on("init.dt.fixedColumns",function(a,b){if("dt"===a.namespace){a=b.oInit.fixedColumns;var d=l.defaults.fixedColumns;if(a||d)d=c.extend({},a,d),!1!==a&&new p(b,d)}});c.fn.dataTable.FixedColumns=p;return c.fn.DataTable.FixedColumns=p});

/*!
   Copyright 2009-2019 SpryMedia Ltd.

 This source file is free software, available under the following license:
   MIT license - http://datatables.net/license/mit

 This source file is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 or FITNESS FOR A PARTICULAR PURPOSE. See the license files for details.

 For details please refer to: http://www.datatables.net
 FixedHeader 3.1.6
 ©2009-2019 SpryMedia Ltd - datatables.net/license
*/
var $jscomp=$jscomp||{};$jscomp.scope={};$jscomp.findInternal=function(c,f,g){c instanceof String&&(c=String(c));for(var l=c.length,h=0;h<l;h++){var n=c[h];if(f.call(g,n,h,c))return{i:h,v:n}}return{i:-1,v:void 0}};$jscomp.ASSUME_ES5=!1;$jscomp.ASSUME_NO_NATIVE_MAP=!1;$jscomp.ASSUME_NO_NATIVE_SET=!1;$jscomp.SIMPLE_FROUND_POLYFILL=!1;
$jscomp.defineProperty=$jscomp.ASSUME_ES5||"function"==typeof Object.defineProperties?Object.defineProperty:function(c,f,g){c!=Array.prototype&&c!=Object.prototype&&(c[f]=g.value)};$jscomp.getGlobal=function(c){return"undefined"!=typeof window&&window===c?c:"undefined"!=typeof global&&null!=global?global:c};$jscomp.global=$jscomp.getGlobal(this);
$jscomp.polyfill=function(c,f,g,l){if(f){g=$jscomp.global;c=c.split(".");for(l=0;l<c.length-1;l++){var h=c[l];h in g||(g[h]={});g=g[h]}c=c[c.length-1];l=g[c];f=f(l);f!=l&&null!=f&&$jscomp.defineProperty(g,c,{configurable:!0,writable:!0,value:f})}};$jscomp.polyfill("Array.prototype.find",function(c){return c?c:function(c,g){return $jscomp.findInternal(this,c,g).v}},"es6","es3");
(function(c){"function"===typeof define&&define.amd?define(["jquery","datatables.net"],function(f){return c(f,window,document)}):"object"===typeof exports?module.exports=function(f,g){f||(f=window);g&&g.fn.dataTable||(g=require("datatables.net")(f,g).$);return c(g,f,f.document)}:c(jQuery,window,document)})(function(c,f,g,l){var h=c.fn.dataTable,n=0,m=function(a,b){if(!(this instanceof m))throw"FixedHeader must be initialised with the 'new' keyword.";!0===b&&(b={});a=new h.Api(a);this.c=c.extend(!0,
{},m.defaults,b);this.s={dt:a,position:{theadTop:0,tbodyTop:0,tfootTop:0,tfootBottom:0,width:0,left:0,tfootHeight:0,theadHeight:0,windowHeight:c(f).height(),visible:!0},headerMode:null,footerMode:null,autoWidth:a.settings()[0].oFeatures.bAutoWidth,namespace:".dtfc"+n++,scrollLeft:{header:-1,footer:-1},enable:!0};this.dom={floatingHeader:null,thead:c(a.table().header()),tbody:c(a.table().body()),tfoot:c(a.table().footer()),header:{host:null,floating:null,placeholder:null},footer:{host:null,floating:null,
placeholder:null}};this.dom.header.host=this.dom.thead.parent();this.dom.footer.host=this.dom.tfoot.parent();a=a.settings()[0];if(a._fixedHeader)throw"FixedHeader already initialised on table "+a.nTable.id;a._fixedHeader=this;this._constructor()};c.extend(m.prototype,{destroy:function(){this.s.dt.off(".dtfc");c(f).off(this.s.namespace);this.c.header&&this._modeChange("in-place","header",!0);this.c.footer&&this.dom.tfoot.length&&this._modeChange("in-place","footer",!0)},enable:function(a,b){this.s.enable=
a;if(b||b===l)this._positions(),this._scroll(!0)},enabled:function(){return this.s.enable},headerOffset:function(a){a!==l&&(this.c.headerOffset=a,this.update());return this.c.headerOffset},footerOffset:function(a){a!==l&&(this.c.footerOffset=a,this.update());return this.c.footerOffset},update:function(){var a=this.s.dt.table().node();c(a).is(":visible")?this.enable(!0,!1):this.enable(!1,!1);this._positions();this._scroll(!0)},_constructor:function(){var a=this,b=this.s.dt;c(f).on("scroll"+this.s.namespace,
function(){a._scroll()}).on("resize"+this.s.namespace,h.util.throttle(function(){a.s.position.windowHeight=c(f).height();a.update()},50));var e=c(".fh-fixedHeader");!this.c.headerOffset&&e.length&&(this.c.headerOffset=e.outerHeight());e=c(".fh-fixedFooter");!this.c.footerOffset&&e.length&&(this.c.footerOffset=e.outerHeight());b.on("column-reorder.dt.dtfc column-visibility.dt.dtfc draw.dt.dtfc column-sizing.dt.dtfc responsive-display.dt.dtfc",function(){a.update()});b.on("destroy.dtfc",function(){a.destroy()});
this._positions();this._scroll()},_clone:function(a,b){var e=this.s.dt,d=this.dom[a],k="header"===a?this.dom.thead:this.dom.tfoot;!b&&d.floating?d.floating.removeClass("fixedHeader-floating fixedHeader-locked"):(d.floating&&(d.placeholder.remove(),this._unsize(a),d.floating.children().detach(),d.floating.remove()),d.floating=c(e.table().node().cloneNode(!1)).css("table-layout","fixed").attr("aria-hidden","true").removeAttr("id").append(k).appendTo("body"),d.placeholder=k.clone(!1),d.placeholder.find("*[id]").removeAttr("id"),
d.host.prepend(d.placeholder),this._matchWidths(d.placeholder,d.floating))},_matchWidths:function(a,b){var e=function(b){return c(b,a).map(function(){return c(this).width()}).toArray()},d=function(a,d){c(a,b).each(function(a){c(this).css({width:d[a],minWidth:d[a]})})},k=e("th");e=e("td");d("th",k);d("td",e)},_unsize:function(a){var b=this.dom[a].floating;b&&("footer"===a||"header"===a&&!this.s.autoWidth)?c("th, td",b).css({width:"",minWidth:""}):b&&"header"===a&&c("th, td",b).css("min-width","")},
_horizontal:function(a,b){var c=this.dom[a],d=this.s.position,k=this.s.scrollLeft;c.floating&&k[a]!==b&&(c.floating.css("left",d.left-b),k[a]=b)},_modeChange:function(a,b,e){var d=this.dom[b],k=this.s.position,f=this.dom["footer"===b?"tfoot":"thead"],h=c.contains(f[0],g.activeElement)?g.activeElement:null;h&&h.blur();"in-place"===a?(d.placeholder&&(d.placeholder.remove(),d.placeholder=null),this._unsize(b),"header"===b?d.host.prepend(f):d.host.append(f),d.floating&&(d.floating.remove(),d.floating=
null)):"in"===a?(this._clone(b,e),d.floating.addClass("fixedHeader-floating").css("header"===b?"top":"bottom",this.c[b+"Offset"]).css("left",k.left+"px").css("width",k.width+"px"),"footer"===b&&d.floating.css("top","")):"below"===a?(this._clone(b,e),d.floating.addClass("fixedHeader-locked").css("top",k.tfootTop-k.theadHeight).css("left",k.left+"px").css("width",k.width+"px")):"above"===a&&(this._clone(b,e),d.floating.addClass("fixedHeader-locked").css("top",k.tbodyTop).css("left",k.left+"px").css("width",
k.width+"px"));h&&h!==g.activeElement&&setTimeout(function(){h.focus()},10);this.s.scrollLeft.header=-1;this.s.scrollLeft.footer=-1;this.s[b+"Mode"]=a},_positions:function(){var a=this.s.dt.table(),b=this.s.position,e=this.dom;a=c(a.node());var d=a.children("thead"),k=a.children("tfoot");e=e.tbody;b.visible=a.is(":visible");b.width=a.outerWidth();b.left=a.offset().left;b.theadTop=d.offset().top;b.tbodyTop=e.offset().top;b.tbodyHeight=e.outerHeight();b.theadHeight=b.tbodyTop-b.theadTop;k.length?(b.tfootTop=
k.offset().top,b.tfootBottom=b.tfootTop+k.outerHeight(),b.tfootHeight=b.tfootBottom-b.tfootTop):(b.tfootTop=b.tbodyTop+e.outerHeight(),b.tfootBottom=b.tfootTop,b.tfootHeight=b.tfootTop)},_scroll:function(a){var b=c(g).scrollTop(),e=c(g).scrollLeft(),d=this.s.position,k;if(this.c.header){var f=this.s.enable?!d.visible||b<=d.theadTop-this.c.headerOffset?"in-place":b<=d.tfootTop-d.theadHeight-this.c.headerOffset?"in":"below":"in-place";(a||f!==this.s.headerMode)&&this._modeChange(f,"header",a);this._horizontal("header",
e)}this.c.footer&&this.dom.tfoot.length&&(this.s.enable&&(k=!d.visible||b+d.windowHeight>=d.tfootBottom+this.c.footerOffset?"in-place":d.windowHeight+b>d.tbodyTop+d.tfootHeight+this.c.footerOffset?"in":"above"),(a||k!==this.s.footerMode)&&this._modeChange(k,"footer",a),this._horizontal("footer",e))}});m.version="3.1.6";m.defaults={header:!0,footer:!1,headerOffset:0,footerOffset:0};c.fn.dataTable.FixedHeader=m;c.fn.DataTable.FixedHeader=m;c(g).on("init.dt.dtfh",function(a,b,e){"dt"===a.namespace&&
(a=b.oInit.fixedHeader,e=h.defaults.fixedHeader,!a&&!e||b._fixedHeader||(e=c.extend({},e,a),!1!==a&&new m(b,e)))});h.Api.register("fixedHeader()",function(){});h.Api.register("fixedHeader.adjust()",function(){return this.iterator("table",function(a){(a=a._fixedHeader)&&a.update()})});h.Api.register("fixedHeader.enable()",function(a){return this.iterator("table",function(b){b=b._fixedHeader;a=a!==l?a:!0;b&&a!==b.enabled()&&b.enable(a)})});h.Api.register("fixedHeader.enabled()",function(){return this.context.length&&
fh?fh.enabled():!1});h.Api.register("fixedHeader.disable()",function(){return this.iterator("table",function(a){(a=a._fixedHeader)&&a.enabled()&&a.enable(!1)})});c.each(["header","footer"],function(a,b){h.Api.register("fixedHeader."+b+"Offset()",function(a){var c=this.context;return a===l?c.length&&c[0]._fixedHeader?c[0]._fixedHeader[b+"Offset"]():l:this.iterator("table",function(c){if(c=c._fixedHeader)c[b+"Offset"](a)})})});return m});

$( document ).ready( function () {
	var $window = $( 'body' );
	var $tableTooltip = $( '.table-tooltip' );
	var $tooltipPopup = $( '.tooltip-popup' );

	$tooltipPopup.on( 'mouseover', function () {
		var _this = $( this );

		var _hoverText = _this.data( 'tooltip' );

		var mobileClass = "";
		var eTop = _this.offset().top - 26;
		var eLeft = _this.offset().left + 62;

		if ( $( window ).width() < 768 ) {
			mobileClass = "-mobile";
			eTop = _this.offset().top + 37;
			eLeft = _this.offset().left - 194;
		}

		$tableTooltip.css( {
			'top': eTop + 'px',
			'left': eLeft + 'px'
		} ).addClass( mobileClass ).text( _hoverText ).show();
	} ).on( 'mouseout', function () {
		$tableTooltip.text( '' ).removeClass( '-mobile' ).hide();
	} );
	$tooltipPopup.on( 'touchend', function () {
		if ( $tableTooltip.is( ':hidden' ) ) {
			$( this ).trigger( 'mouseover' );
		} else {
			$( this ).trigger( 'mouseout' );
		}
	} );
} );

$( document ).on( 'speedbump:ready', function () {
	var $body = $( 'body' );
	var $speedbumpModal = $( '.speedbump-modal' );
	var $experienceFragments = $( '.experience-fragments' );
	var $allTabbableElements = $('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, *[tabindex], *[contenteditable]');
	var $speedbumpTabbableElements = $('.speedbump-close:not([disabled]), .speedbump-title:not([disabled]), .speedbump-text:not([disabled]), .speedbump-cta:not([disabled])');
	
	var $speedbumpComponent = $('.speedbump-modal.component');
	var speedbumpPage = $speedbumpComponent.data('speedbump-page');
	if (!speedbumpPage) {
			speedbumpPage = '/speedbump.html';
	}
	
	var $speedbump;
	 $speedbump = {
		findSpeedbumps: function () {
			$( document ).find( '.speedbump-cta .cta-button-link' ).on( 'click', function ( event ) {
				if ( event.originalEvent.type === 'keypress' ) {
					var target = $( '.cta-button-link' ).attr( 'target' );
					var url = $( '.cta-button-link' ).attr( 'href' );
					window.open( url, target );
				}
				$speedbump.hideSpeedbump();
			} );

			$( document ).find( '.speedbump-body' ).on( 'click', function ( event ) {
			} );

			$( document ).find( '.speedbump-modal' ).on( 'click', function () {
				$speedbump.hideSpeedbump();
			} );

			$( document ).find( '.speedbump-modal .speedbump-close, .speedbump-modal .cta-button-link' ).on( 'keypress', function ( event ) {
				if ( event.which === 13 || event.which === 32 ) {
					event.type = 'click';
					$( event.target ).trigger( event );
				}
			} );

			$( document ).find( '.speedbump-modal' ).on( 'keydown', function ( event ) {
				if ( event.which === 27 ) {
					$speedbump.hideSpeedbump();
				}
			} );

			$( document ).find( '.speedbump-item' ).on( 'click', function ( event ) {
				event.preventDefault();
				var $eventTarget = $( event.target );
				var $link = $eventTarget;
				if ( !$eventTarget.is( 'a' ) ) {
					// get closest link to handle icons that are inside anchors
					$link = $eventTarget.closest( 'a' );
				}
				var url = $link.attr( 'href' );
				
				var destParam = "dest=" + url;
				window.location = speedbumpPage + "?" + destParam;
				return false;

			} );

			$( document ).find( '.speedbump-close' ).on( 'click', function () {
				$speedbump.hideSpeedbump();
			} );
		},
		handleTabbing: function () {
			//ADA: Remove tabbing for all tabbable elements not inside the speedbump modal and set a tabindex on the close button and focus on it first when the modal opens
			$allTabbableElements.each(function () {
				$(this).attr('tabindex', '-1');
				$(this).attr('aria-hidden', 'true');

			});
			$speedbumpTabbableElements.each(function () {
				var $speedbumpElement = $(this);
				if ($speedbumpElement.is(':visible')) {
					$speedbumpElement.attr('tabindex', 0);
					$speedbumpElement.attr('aria-hidden', 'false');
				}
			});
		},
		applyContainTabbing: function() {
			//Apply aria-hidden and remove all controls from tab order here
			$experienceFragments.find( '.speedbump' ).attr( 'aria-hidden', false );
			$experienceFragments.find( '.header' ).attr( 'aria-hidden', true );
			$experienceFragments.find( '.modal' ).attr( 'aria-hidden', true );
			$experienceFragments.find( '.experience-fragments' ).attr( 'aria-hidden', true );
			$experienceFragments.find( '.footer' ).attr( 'aria-hidden', true );
			$experienceFragments.find( '.disclosure' ).attr( 'aria-hidden', true );
			$( '.login-modal' ).attr( 'aria-hidden', true );
		},
		removeContainTabbing: function() {
			//Remove aria-hidden and re-insert all controls into tab order here
			$experienceFragments.find( '.speedbump' ).attr( 'aria-hidden', true );
			$experienceFragments.find( '.header' ).attr( 'aria-hidden', false );
			$experienceFragments.find( '.modal' ).attr( 'aria-hidden', false );
			$experienceFragments.find( '.experience-fragments' ).attr( 'aria-hidden', true );
			$experienceFragments.find( '.footer' ).attr( 'aria-hidden', false );
			$experienceFragments.find( '.disclosure' ).attr( 'aria-hidden', false );
			$( '.login-modal' ).attr( 'aria-hidden', false );
		},
		hideSpeedbump: function () {
			$body.removeClass( '-scroll-lock' );
			$( document ).find( '.speedbump-modal' ).addClass( '_hidden' );

			//ADA: Handle tabbing, screen reader arrows and set focus back to the button that was used to open the speedbump modal
			$allTabbableElements.each(function () {
				$(this).removeAttr('tabindex');
				$(this).attr('aria-hidden', 'false');
			});
			$speedbump.removeContainTabbing();
		}
	};

	$speedbump.findSpeedbumps();
} );

$( document ).ready( function () {
	var $skipNavigationLink = $( 'a[href^="#skiptomaincontent"]' );
	var $mainContentSection = $( 'main' );

	//Add the id "skiptomaincontent" to the div that surrounds the main content area of the page.
	$mainContentSection.attr( 'id', 'skiptomaincontent' );

	$skipNavigationLink.on( 'click keydown', function ( e ) {
		if ( e.keyCode === 32 || e.keyCode === 13 || e.type === 'click' ) {
			$skipNavigationLink.blur();
			Utils.fn.makeTempTabbable( $mainContentSection );
			$mainContentSection.focus();
		}
	} );
} );

/*global
	$, jQuery
 */
$(document).ready(function () {
    'use strict';
    
    var $ratesTableComponents = $('.rates-table.component');
    
    var getRegionFromCookie = function () {
        var realCookieVal = Cookies.get('GeoRegion');
        if (!realCookieVal || realCookieVal === 'Emergency') {
            realCookieVal = 'Virtual';
        }
        return  realCookieVal;
    };
    
    var getRatesByRegion = function (region, productName, colOneTitle, colTwoTitle, colThreeTitle) {
        var dynamicQuery = "<View>" +
            "<Query>" +
            "<Where>" +
            "<And>" +
            "<Eq><FieldRef Name='ActiveFlag' /><Value Type='Integer'>1</Value></Eq>" +
            "<Eq><FieldRef Name='RatesMarket' /><Value Type='Text'>" + region + "</Value></Eq>" +
            "</And>" +
            "</Where>" +
            "</Query>" +
            "<ViewFields>" +
            "<FieldRef Name='RatesProductMarketRateID' />" +
            "<FieldRef Name='RatesProduct' />" +
            "<FieldRef Name='RatesMarket' />" +
            "<FieldRef Name='RatesRateRuleID' />" +
            "<FieldRef Name='RatesRateRule' />" +
            "<FieldRef Name='RatesLowerLimit' />" +
            "<FieldRef Name='RatesUpperLimit' />" +
            "<FieldRef Name='RatesInterestRate' />" +
            "<FieldRef Name='RatesAPY' />" +
            "</ViewFields></View>";
        
        var SbpColumnsString = "RatesProductMarketRateID$RatesProduct$RatesMarket$RatesRateRuleID$RatesRateRule$RatesLowerLimit$RatesUpperLimit$RatesInterestRate$RatesAPY$";
        var sbpdataIn = '{ "siteUrl":"https://authoring.mtb.com", "listQry":"' + dynamicQuery + '","listName":" Deposit Product Rates ", "columsList":"' + SbpColumnsString + '" }';
        jQuery.support.cors = true;
        
        $.ajax({
            url: "https://apps.mtb.com/web-services/GetListData.svc/ReadListData",
            type: "POST",
            contentType: "application/json; charset=utf-8",
            data: sbpdataIn,
            dataType: "json",
            crossDomain: true,
            async: true,
            success: function (data) {
                //Initial data returned from the api will be ALL rates for a given region, for all products.
                var accounts = makeUseful(data);
                
                //This function will allow you to pass the raw results through, along with the product name (RatesProduct) you actually want, and consolidate the rates down.
                //You could also filter that out when you query the api as well.
                var consolidatedResult = consolidate(accounts, productName);
                var productSelector = '[data-product-name="' + productName + '"]';
    
                if (consolidatedResult && consolidatedResult.length !== 0) {
                    var headerRowHtml = '<tr><td><p><b>'
                        + colOneTitle
                        + '</b></p></td><td><p><b>'
                        + colTwoTitle
                        + '</b></p></td><td><p><b>'
                        + colThreeTitle
                        + '</b></p></td></tr>';
                    var tableHtml = headerRowHtml;
                    for (var i = 0; i < consolidatedResult.length; i++) {
                        tableHtml += '<tr>';
                        var row = consolidatedResult[i];
                        for (var j = 0; j < row.length; j++) {
                            var cell = row[j];
                            if (j < 1) {
                                tableHtml += '<td><p>' + decodeURI(encodeURI(cell)) + '</p></td>'
                            } else {
                                tableHtml += '<td><p>' + decodeURI(encodeURI(cell)) + '%</p></td>'
                            }
                        }
                        tableHtml += '<tr>';
                    }
    
                    $('.rates-table.component' + productSelector + ' table tbody').html(tableHtml);
                } else {
                    $('.rates-table.component' + productSelector + ' table tbody').html('No rates information for ' + productName + ' in ' + region);
                }
            },
            error: function (xhr, status, error) {
                console.error(error);
            }
        });
    };
    
    var makeUseful = function (data) {
        data = $.parseJSON(data.d);
        
        var items = [];
        
        data.forEach(function (element) {
            var item = {};
            var arr = element.split('#MTBROW#');
            
            arr.forEach(function (node) {
                var header = node.split('#MTBCOL#')[0];
                var value = node.split('#MTBCOL#')[1];
                
                if (header === 'Title') {
                    value = value.replace('Mortgage West', '');
                }
                
                if (header === 'ProductCatalogItemCategory') {
                    item[header] = {
                        Name: value.split('#MTBTERM#')[0],
                        Url: 'https://preview.mtb.com/' + value.split('#MTBTERM#')[2]
                    };
                }
                if (header === 'GeoZipCodeRegionColChoice') {
                    value = value.split('#MTBMLOOKUP#');
                }
                if (header === 'ContentTypeId') {
                    if (value.startsWith('0x01001E596F81D9D94BE7A7314237F46521CF00DE1B38E0D49B4C538523EDAD1C267DDC')) {
                        item.ContentType = '6Across';
                    }
                    if (value.startsWith('0x01001E596F81D9D94BE7A7314237F46521CF00402B0FE33FA14442977126FD9D52DA3D')) {
                        item.ContentType = '3Across';
                    }
                    if (value.startsWith('0x0100E5A5029C2B7D45B4B9FFE096B4E6612B0039F23E5C5E234FE6BB5746D316D307F9')) {
                        item.ContentType = 'HeroPortlet';
                    }
                } else {
                    if (value) {
                        item[header] = value;
                    }
                }
            });
            
            items.push(item);
        });
        
        return items;
    };
    
    var consolidate = function (accounts, queryAccountTitle) {
        var arr = accounts.filter(function (act) {
            if (queryAccountTitle !== '') {
	            return act.RatesProduct === queryAccountTitle;
            } else {
            	return true;
            }
        });
        var sorted = groupBy(arr, 'RatesInterestRate');
        var checkingData = [];
        
        for (var num in sorted) {
            var amounts = [];
            sorted[num].forEach(function (inner) {
                var ratesRule = inner.RatesRateRule.split(" - ");
                amounts = amounts.concat(ratesRule);
            });
            
            if (amounts.indexOf("$1,000,000.00 +") !== -1) {
                amounts.splice(amounts.indexOf("$1,000,000.00 +"), 1);
                amounts.sort(function (a, b) {
                    return a - b
                });
                amounts.push("$1,000,000.00 +");
            } else {
                amounts.sort(function (a, b) {
                    return a - b
                });
            }
            var finalRatesRule = amounts[0] + " - " + amounts[amounts.length - 1];
            checkingData.push([finalRatesRule, sorted[num][0].RatesInterestRate, sorted[num][0].RatesAPY]);
        }
        return checkingData;
    };
    
    var groupBy = function (xs, key) {
        return xs.reduce(function (rv, x) {
            (rv[x[key]] = rv[x[key]] || []).push(x);
            return rv;
        }, {});
    };
    
    var setRateTables = function (productName, colOneTitle, colTwoTitle, colThreeTitle) {
        var region = getRegionFromCookie();
        getRatesByRegion(region, productName, colOneTitle, colTwoTitle, colThreeTitle);
    };
    
    var initRatesTable = function($ratesTableComponent) {
        var productName = $ratesTableComponent.data('product-name');
        var colOneTitle = $ratesTableComponent.data('col-1-title');
        var colTwoTitle = $ratesTableComponent.data('col-2-title');
        var colThreeTitle = $ratesTableComponent.data('col-3-title');
        setRateTables(productName, colOneTitle, colTwoTitle, colThreeTitle);
    };
    
    var initEachRatesTable = function ($ratesTableComponents) {
        $ratesTableComponents.each(function () {
            var $ratesTableComponent = $(this);
            initRatesTable($ratesTableComponent);
        });
        
        // listen for 'fetch-rates' event and update tables
        Utils.customEvents.rates.applyRatesHandler($ratesTableComponents, function () {
            var $ratesTableComponent = $(this);
            initRatesTable($ratesTableComponent);
        });
    };
    initEachRatesTable($ratesTableComponents);
});

$( document ).ready( function () {
	var screenWidth = 1366;
	var $modalContainer = $( '.modal-container' );
	var $parentLinks = $( '.navigation-parent .navigation-link.parent-title' );
	var $firstParentNavLink = $parentLinks.first();
	var $navigationOptions = $( '.navigation-options' );

	$modalContainer.on( 'focus', '.navigation-link.parent-title', function ( e ) {
		if ( $modalContainer.width() >= screenWidth ) {
			showChildNavLinks( e, $( this ).parent() );
		}
	} );

	$modalContainer.on( 'click', '.navigation-link.parent-title', function ( e ) {
		//Open/Close navigation accordion links for mobile view
		if ( $modalContainer.width() < screenWidth ) {
			var $thisLink = $( this );
			e.preventDefault();
			if ( !$thisLink.hasClass( 'open' ) ) {
				$thisLink.addClass( 'open' );
				$navigationOptions.addClass( 'open' );
				showChildNavLinks( e, $thisLink.parent() );
			} else {
				hideChildNavLinks();
			}
		}
	} );

	$modalContainer.on( 'mouseover', '.navigation-parent', function ( e ) {
		if ( $modalContainer.width() >= screenWidth ) {
			showChildNavLinks( e, $( this ) );
		}
	} );

	$modalContainer.on( 'mouseout', '.navigation-parent', function () {
		// hides on desktop
		if ( $modalContainer.width() >= screenWidth ) {
			var $parentLink = $( this ).children( '.navigation-link' ).first();
			var $child = $( this ).children( '.navigation-children' ).first();
			$child.addClass( '_hidden' );
			$parentLink.removeClass( 'open' );
			$navigationOptions.removeClass( 'open' );
		}
	} );

	$modalContainer.on( 'keydown', '.navigation-children', function ( e ) {
		if ( e.keyCode === 9 && !e.shiftKey ) {
			if ( $( this ).children().children().last().is( ':focus' ) && $modalContainer.width() >= screenWidth ) {
				hideChildNavLinks();
			}
		}
	} );

	$firstParentNavLink.on( 'keydown', function ( e ) {
		if ( $modalContainer.width() >= screenWidth && e.keyCode === 9 && e.shiftKey ) {
			hideChildNavLinks();
		}
	} );

	var hideChildNavLinks = function () {
		$( '.navigation-children' ).addClass( '_hidden' );
		$parentLinks.removeAttr( 'aria-expanded' ).removeClass( 'open' ).attr( 'role', 'button' );
		$navigationOptions.removeClass( 'open' );
	}

	var showChildNavLinks = function ( e, thisNavParent ) {
		var $thisNavParent = thisNavParent;
		var $parentLink = $thisNavParent.children( '.navigation-link' ).first();
		var child = $thisNavParent.children( '.navigation-children' ).first();
		$parentLink.attr( 'aria-label', $parentLink.text() );
		hideChildNavLinks();

		if ( child.hasClass( '_hidden' ) ) {
			e.preventDefault();
			child.removeClass( '_hidden' );
			$parentLink.addClass( 'open' );
			$navigationOptions.addClass( 'open' );
			$parentLinks.attr( { 'aria-expanded': 'true', 'role': 'link' } );
		}
	};

	//Set the icon hrefs to match the ones set in the header:
	$( '.navigation-option.search' ).attr( 'href', $( '.header-icon.-icon-magnifying-glass' ).parent().attr( 'href' ) );
	$( '.navigation-option.help-center' ).attr( 'href', $( '.header-icon.-icon-question-mark' ).parent().attr( 'href' ) );
	$( '.navigation-option.location' ).attr( 'href', $( '.header-icon.-icon-location-pin' ).parent().attr( 'href' ) );
} );

/*global
	$, jQuery, Utils
 */

$( document ).ready( function ( $ ) {
	"use strict";
	// TODO clean up this file to match the js patterns
	var $body = $( 'body' );
	var $modalContainer = $( '.modal-container' );
	var $modalClose = $( '.modal-close' );
	var $currentModal;
	var $originalModalLocation;
	var $openModalButton = null; //Any button that is used to open a modal, Keeping track so that focus can be returned to it.
	var $firstActionableModalElement = null;
	var $modalAnchor;

	var clearModalHtml = function () {
		// Fade out the modal
		$modalContainer.find( ".modal-data" ).fadeOut( "fast", "linear" );
		// Move the content back to the original location
		if ( $currentModal ) {
			$currentModal.appendTo( $originalModalLocation ).addClass( "_hidden" );
			$currentModal = undefined;
		}
		// Clear the modal container for the next modal
		$modalContainer.html( "" ).css( "background-color", "" ).attr( "class", "modal-container" );
		$( "body" ).css( "overflow", "" );
	};
	var closeModal = function () {
		if ( $( ".modal-clone-close" ).hasClass( "-white" ) ) {
			$( ".navigation-back" ).trigger( "click" );
		}
		$modalContainer.fadeToggle( "fast", "linear" );
		clearModalHtml();
		$( "main" ).attr( "aria-hidden", "false" );
		//Show everything that was behind the modal after the modal is closed
		Utils.modal.unhideNonModalElements();
		// Return focus back to the button that was clicked to open the modal
		$openModalButton.focus();
		$modalAnchor = null;
		$( '.modal-data' ).find( '.lazyloaded' ).removeClass( 'lazyloaded' ).addClass( 'lazyload' );
	};
	var handleModalTabbing = function () {
		$( ".modal-clone-close" ).attr( "tabindex", "0" );
		$( "main" ).attr( "aria-hidden", "true" );
		$firstActionableModalElement = Utils.modal.getFirstActionableModelElement();
		if ( $modalContainer.is( ":visible" ) && $firstActionableModalElement !== null ) {
			$firstActionableModalElement.focus();
			$( ".modal-clone-close" ).on( "keydown", function ( e ) {
				if ( !e.shiftKey && e.keyCode === 9 ) {
					e.preventDefault();
					$firstActionableModalElement = Utils.modal.getFirstActionableModelElement().focus();
				}
			} );
			$modalContainer.on( "keydown", function ( e ) {
				if ( e.shiftKey && e.keyCode === 9 ) {
					$firstActionableModalElement = Utils.modal.getFirstActionableModelElement();
					if ( e.target == $firstActionableModalElement.get( 0 ) ) {
						e.preventDefault();
						$( ".modal-clone-close" ).focus();
					}
				}
			} );
		} else {
			$( ".modal-clone-close" ).focus();
		}
	};
	var toggleModal;
	var linkClickCallback = function ( e ) {
		e.preventDefault();
		var $clickedLink = $( this );
		var modalClassName = $clickedLink.attr( 'href' ).substring( 1 );
		toggleModal( modalClassName );

		//ADA: Save the button that was clicked to open the modal so the focus can be set back to it when the modal is closed
		$openModalButton = $clickedLink;
		if ( $openModalButton.hasClass( 'help-center-icon-magnifying-glass-link' ) ) {
			$openModalButton = $( '.help-center-search-field' );
		}
	};
	toggleModal = function ( modalClass ) {
		var modalClassName = "." + modalClass;

		clearModalHtml();
		if ( $modalContainer.is( ":hidden" ) ) {
			$modalContainer.fadeToggle( "fast", "linear" );
		}
		if ( $modalContainer.is( ":visible" ) ) {
			var $this = $( this );
			if ( $this.is( ":hidden" ) ) {
				$body.css( "overflow", "initial" );
				clearModalHtml();
			} else {
				$body.css( "overflow", "hidden" );

				// Check Specific static types to add custom variation classes
				var $customClass = "";
				switch ( modalClassName ) {
					case ".search-modal":
						$customClass = " -search";
						break;
				}
				// Set the current content and the current content original location
				$currentModal = $( modalClassName ).eq( 0 );
				$originalModalLocation = $currentModal.parent();
				// Add content to modal
				if ( modalClassName !== "" ) {
					// Detach the selected content for the modal and then append it to the end of the body
					$currentModal.detach().removeClass( "_hidden" ).prependTo( ".modal-container" ).fadeIn( "fast", "linear" );
					$modalContainer.addClass( $customClass ).find( modalClassName ).addClass( "-open", "fast", "linear" );
				}

				//hide everything except the modal-container while the modal is open to keep voice over within the modal when using the arrows
				Utils.modal.hideNonModalElements();

				// Add close button
				$modalClose.clone().removeClass( "modal-close" ).addClass( "modal-clone-close" ).appendTo( ".modal-container" );
				handleModalTabbing();
				// Other Specific static types of actions
				switch ( modalClassName ) {
					case ".search-modal":
						$modalContainer.find( "#searchInput" ).focus();
						break;
				}
				$( ".modal-clone-close" ).on( "click", function ( e ) {
					e.preventDefault();
					closeModal();
				} );
			}
		}
	};
	Utils.modal.bindModalButtons( linkClickCallback );
	//ADA: Close the modal if the ESC key is pressed:
	$body.on( "keydown", function ( e ) {
		if ( e.keyCode === 27 && $modalContainer.is( ":visible" ) ) {
			closeModal();
		}
	} );
	$( document ).on( 'openLogin', function () {
		Utils.fn.makeTempTabbable( $body );
		$openModalButton = $body;
		toggleModal( 'login-modal' );
	} );
} );

!function(i){"use strict";"function"==typeof define&&define.amd?define(["jquery"],i):"undefined"!=typeof exports?module.exports=i(require("jquery")):i(jQuery)}(function(i){"use strict";var e=window.Slick||{};(e=function(){var e=0;return function(t,o){var s,n=this;n.defaults={accessibility:!0,adaptiveHeight:!1,appendArrows:i(t),appendDots:i(t),arrows:!0,asNavFor:null,prevArrow:'<button class="slick-prev" aria-label="Previous" type="button">Previous</button>',nextArrow:'<button class="slick-next" aria-label="Next" type="button">Next</button>',autoplay:!1,autoplaySpeed:3e3,centerMode:!1,centerPadding:"50px",cssEase:"ease",customPaging:function(e,t){return i('<button type="button" />').text(t+1)},dots:!1,dotsClass:"slick-dots",draggable:!0,easing:"linear",edgeFriction:.35,fade:!1,focusOnSelect:!1,focusOnChange:!1,infinite:!0,initialSlide:0,lazyLoad:"ondemand",mobileFirst:!1,pauseOnHover:!0,pauseOnFocus:!0,pauseOnDotsHover:!1,respondTo:"window",responsive:null,rows:1,rtl:!1,slide:"",slidesPerRow:1,slidesToShow:1,slidesToScroll:1,speed:500,swipe:!0,swipeToSlide:!1,touchMove:!0,touchThreshold:5,useCSS:!0,useTransform:!0,variableWidth:!1,vertical:!1,verticalSwiping:!1,waitForAnimate:!0,zIndex:1e3},n.initials={animating:!1,dragging:!1,autoPlayTimer:null,currentDirection:0,currentLeft:null,currentSlide:0,direction:1,$dots:null,listWidth:null,listHeight:null,loadIndex:0,$nextArrow:null,$prevArrow:null,scrolling:!1,slideCount:null,slideWidth:null,$slideTrack:null,$slides:null,sliding:!1,slideOffset:0,swipeLeft:null,swiping:!1,$list:null,touchObject:{},transformsEnabled:!1,unslicked:!1},i.extend(n,n.initials),n.activeBreakpoint=null,n.animType=null,n.animProp=null,n.breakpoints=[],n.breakpointSettings=[],n.cssTransitions=!1,n.focussed=!1,n.interrupted=!1,n.hidden="hidden",n.paused=!0,n.positionProp=null,n.respondTo=null,n.rowCount=1,n.shouldClick=!0,n.$slider=i(t),n.$slidesCache=null,n.transformType=null,n.transitionType=null,n.visibilityChange="visibilitychange",n.windowWidth=0,n.windowTimer=null,s=i(t).data("slick")||{},n.options=i.extend({},n.defaults,o,s),n.currentSlide=n.options.initialSlide,n.originalSettings=n.options,void 0!==document.mozHidden?(n.hidden="mozHidden",n.visibilityChange="mozvisibilitychange"):void 0!==document.webkitHidden&&(n.hidden="webkitHidden",n.visibilityChange="webkitvisibilitychange"),n.autoPlay=i.proxy(n.autoPlay,n),n.autoPlayClear=i.proxy(n.autoPlayClear,n),n.autoPlayIterator=i.proxy(n.autoPlayIterator,n),n.changeSlide=i.proxy(n.changeSlide,n),n.clickHandler=i.proxy(n.clickHandler,n),n.selectHandler=i.proxy(n.selectHandler,n),n.setPosition=i.proxy(n.setPosition,n),n.swipeHandler=i.proxy(n.swipeHandler,n),n.dragHandler=i.proxy(n.dragHandler,n),n.keyHandler=i.proxy(n.keyHandler,n),n.instanceUid=e++,n.htmlExpr=/^(?:\s*(<[\w\W]+>)[^>]*)$/,n.registerBreakpoints(),n.init(!0)}}()).prototype.activateADA=function(){this.$slideTrack.find(".slick-active").attr({"aria-hidden":"false"}).find("a, input, button, select").attr({tabindex:"0"})},e.prototype.addSlide=e.prototype.slickAdd=function(e,t,o){var s=this;if("boolean"==typeof t)o=t,t=null;else if(t<0||t>=s.slideCount)return!1;s.unload(),"number"==typeof t?0===t&&0===s.$slides.length?i(e).appendTo(s.$slideTrack):o?i(e).insertBefore(s.$slides.eq(t)):i(e).insertAfter(s.$slides.eq(t)):!0===o?i(e).prependTo(s.$slideTrack):i(e).appendTo(s.$slideTrack),s.$slides=s.$slideTrack.children(this.options.slide),s.$slideTrack.children(this.options.slide).detach(),s.$slideTrack.append(s.$slides),s.$slides.each(function(e,t){i(t).attr("data-slick-index",e)}),s.$slidesCache=s.$slides,s.reinit()},e.prototype.animateHeight=function(){var i=this;if(1===i.options.slidesToShow&&!0===i.options.adaptiveHeight&&!1===i.options.vertical){var e=i.$slides.eq(i.currentSlide).outerHeight(!0);i.$list.animate({height:e},i.options.speed)}},e.prototype.animateSlide=function(e,t){var o={},s=this;s.animateHeight(),!0===s.options.rtl&&!1===s.options.vertical&&(e=-e),!1===s.transformsEnabled?!1===s.options.vertical?s.$slideTrack.animate({left:e},s.options.speed,s.options.easing,t):s.$slideTrack.animate({top:e},s.options.speed,s.options.easing,t):!1===s.cssTransitions?(!0===s.options.rtl&&(s.currentLeft=-s.currentLeft),i({animStart:s.currentLeft}).animate({animStart:e},{duration:s.options.speed,easing:s.options.easing,step:function(i){i=Math.ceil(i),!1===s.options.vertical?(o[s.animType]="translate("+i+"px, 0px)",s.$slideTrack.css(o)):(o[s.animType]="translate(0px,"+i+"px)",s.$slideTrack.css(o))},complete:function(){t&&t.call()}})):(s.applyTransition(),e=Math.ceil(e),!1===s.options.vertical?o[s.animType]="translate3d("+e+"px, 0px, 0px)":o[s.animType]="translate3d(0px,"+e+"px, 0px)",s.$slideTrack.css(o),t&&setTimeout(function(){s.disableTransition(),t.call()},s.options.speed))},e.prototype.getNavTarget=function(){var e=this,t=e.options.asNavFor;return t&&null!==t&&(t=i(t).not(e.$slider)),t},e.prototype.asNavFor=function(e){var t=this.getNavTarget();null!==t&&"object"==typeof t&&t.each(function(){var t=i(this).slick("getSlick");t.unslicked||t.slideHandler(e,!0)})},e.prototype.applyTransition=function(i){var e=this,t={};!1===e.options.fade?t[e.transitionType]=e.transformType+" "+e.options.speed+"ms "+e.options.cssEase:t[e.transitionType]="opacity "+e.options.speed+"ms "+e.options.cssEase,!1===e.options.fade?e.$slideTrack.css(t):e.$slides.eq(i).css(t)},e.prototype.autoPlay=function(){var i=this;i.autoPlayClear(),i.slideCount>i.options.slidesToShow&&(i.autoPlayTimer=setInterval(i.autoPlayIterator,i.options.autoplaySpeed))},e.prototype.autoPlayClear=function(){var i=this;i.autoPlayTimer&&clearInterval(i.autoPlayTimer)},e.prototype.autoPlayIterator=function(){var i=this,e=i.currentSlide+i.options.slidesToScroll;i.paused||i.interrupted||i.focussed||(!1===i.options.infinite&&(1===i.direction&&i.currentSlide+1===i.slideCount-1?i.direction=0:0===i.direction&&(e=i.currentSlide-i.options.slidesToScroll,i.currentSlide-1==0&&(i.direction=1))),i.slideHandler(e))},e.prototype.buildArrows=function(){var e=this;!0===e.options.arrows&&(e.$prevArrow=i(e.options.prevArrow).addClass("slick-arrow"),e.$nextArrow=i(e.options.nextArrow).addClass("slick-arrow"),e.slideCount>e.options.slidesToShow?(e.$prevArrow.removeClass("slick-hidden").removeAttr("aria-hidden tabindex"),e.$nextArrow.removeClass("slick-hidden").removeAttr("aria-hidden tabindex"),e.htmlExpr.test(e.options.prevArrow)&&e.$prevArrow.prependTo(e.options.appendArrows),e.htmlExpr.test(e.options.nextArrow)&&e.$nextArrow.appendTo(e.options.appendArrows),!0!==e.options.infinite&&e.$prevArrow.addClass("slick-disabled").attr("aria-disabled","true")):e.$prevArrow.add(e.$nextArrow).addClass("slick-hidden").attr({"aria-disabled":"true",tabindex:"-1"}))},e.prototype.buildDots=function(){var e,t,o=this;if(!0===o.options.dots){for(o.$slider.addClass("slick-dotted"),t=i("<ul />").addClass(o.options.dotsClass),e=0;e<=o.getDotCount();e+=1)t.append(i("<li />").append(o.options.customPaging.call(this,o,e)));o.$dots=t.appendTo(o.options.appendDots),o.$dots.find("li").first().addClass("slick-active")}},e.prototype.buildOut=function(){var e=this;e.$slides=e.$slider.children(e.options.slide+":not(.slick-cloned)").addClass("slick-slide"),e.slideCount=e.$slides.length,e.$slides.each(function(e,t){i(t).attr("data-slick-index",e).data("originalStyling",i(t).attr("style")||"")}),e.$slider.addClass("slick-slider"),e.$slideTrack=0===e.slideCount?i('<div class="slick-track"/>').appendTo(e.$slider):e.$slides.wrapAll('<div class="slick-track"/>').parent(),e.$list=e.$slideTrack.wrap('<div class="slick-list"/>').parent(),e.$slideTrack.css("opacity",0),!0!==e.options.centerMode&&!0!==e.options.swipeToSlide||(e.options.slidesToScroll=1),i("img[data-lazy]",e.$slider).not("[src]").addClass("slick-loading"),e.setupInfinite(),e.buildArrows(),e.buildDots(),e.updateDots(),e.setSlideClasses("number"==typeof e.currentSlide?e.currentSlide:0),!0===e.options.draggable&&e.$list.addClass("draggable")},e.prototype.buildRows=function(){var i,e,t,o,s,n,r,l=this;if(o=document.createDocumentFragment(),n=l.$slider.children(),l.options.rows>1){for(r=l.options.slidesPerRow*l.options.rows,s=Math.ceil(n.length/r),i=0;i<s;i++){var d=document.createElement("div");for(e=0;e<l.options.rows;e++){var a=document.createElement("div");for(t=0;t<l.options.slidesPerRow;t++){var c=i*r+(e*l.options.slidesPerRow+t);n.get(c)&&a.appendChild(n.get(c))}d.appendChild(a)}o.appendChild(d)}l.$slider.empty().append(o),l.$slider.children().children().children().css({width:100/l.options.slidesPerRow+"%",display:"inline-block"})}},e.prototype.checkResponsive=function(e,t){var o,s,n,r=this,l=!1,d=r.$slider.width(),a=window.innerWidth||i(window).width();if("window"===r.respondTo?n=a:"slider"===r.respondTo?n=d:"min"===r.respondTo&&(n=Math.min(a,d)),r.options.responsive&&r.options.responsive.length&&null!==r.options.responsive){s=null;for(o in r.breakpoints)r.breakpoints.hasOwnProperty(o)&&(!1===r.originalSettings.mobileFirst?n<r.breakpoints[o]&&(s=r.breakpoints[o]):n>r.breakpoints[o]&&(s=r.breakpoints[o]));null!==s?null!==r.activeBreakpoint?(s!==r.activeBreakpoint||t)&&(r.activeBreakpoint=s,"unslick"===r.breakpointSettings[s]?r.unslick(s):(r.options=i.extend({},r.originalSettings,r.breakpointSettings[s]),!0===e&&(r.currentSlide=r.options.initialSlide),r.refresh(e)),l=s):(r.activeBreakpoint=s,"unslick"===r.breakpointSettings[s]?r.unslick(s):(r.options=i.extend({},r.originalSettings,r.breakpointSettings[s]),!0===e&&(r.currentSlide=r.options.initialSlide),r.refresh(e)),l=s):null!==r.activeBreakpoint&&(r.activeBreakpoint=null,r.options=r.originalSettings,!0===e&&(r.currentSlide=r.options.initialSlide),r.refresh(e),l=s),e||!1===l||r.$slider.trigger("breakpoint",[r,l])}},e.prototype.changeSlide=function(e,t){var o,s,n,r=this,l=i(e.currentTarget);switch(l.is("a")&&e.preventDefault(),l.is("li")||(l=l.closest("li")),n=r.slideCount%r.options.slidesToScroll!=0,o=n?0:(r.slideCount-r.currentSlide)%r.options.slidesToScroll,e.data.message){case"previous":s=0===o?r.options.slidesToScroll:r.options.slidesToShow-o,r.slideCount>r.options.slidesToShow&&r.slideHandler(r.currentSlide-s,!1,t);break;case"next":s=0===o?r.options.slidesToScroll:o,r.slideCount>r.options.slidesToShow&&r.slideHandler(r.currentSlide+s,!1,t);break;case"index":var d=0===e.data.index?0:e.data.index||l.index()*r.options.slidesToScroll;r.slideHandler(r.checkNavigable(d),!1,t),l.children().trigger("focus");break;default:return}},e.prototype.checkNavigable=function(i){var e,t;if(e=this.getNavigableIndexes(),t=0,i>e[e.length-1])i=e[e.length-1];else for(var o in e){if(i<e[o]){i=t;break}t=e[o]}return i},e.prototype.cleanUpEvents=function(){var e=this;e.options.dots&&null!==e.$dots&&(i("li",e.$dots).off("click.slick",e.changeSlide).off("mouseenter.slick",i.proxy(e.interrupt,e,!0)).off("mouseleave.slick",i.proxy(e.interrupt,e,!1)),!0===e.options.accessibility&&e.$dots.off("keydown.slick",e.keyHandler)),e.$slider.off("focus.slick blur.slick"),!0===e.options.arrows&&e.slideCount>e.options.slidesToShow&&(e.$prevArrow&&e.$prevArrow.off("click.slick",e.changeSlide),e.$nextArrow&&e.$nextArrow.off("click.slick",e.changeSlide),!0===e.options.accessibility&&(e.$prevArrow&&e.$prevArrow.off("keydown.slick",e.keyHandler),e.$nextArrow&&e.$nextArrow.off("keydown.slick",e.keyHandler))),e.$list.off("touchstart.slick mousedown.slick",e.swipeHandler),e.$list.off("touchmove.slick mousemove.slick",e.swipeHandler),e.$list.off("touchend.slick mouseup.slick",e.swipeHandler),e.$list.off("touchcancel.slick mouseleave.slick",e.swipeHandler),e.$list.off("click.slick",e.clickHandler),i(document).off(e.visibilityChange,e.visibility),e.cleanUpSlideEvents(),!0===e.options.accessibility&&e.$list.off("keydown.slick",e.keyHandler),!0===e.options.focusOnSelect&&i(e.$slideTrack).children().off("click.slick",e.selectHandler),i(window).off("orientationchange.slick.slick-"+e.instanceUid,e.orientationChange),i(window).off("resize.slick.slick-"+e.instanceUid,e.resize),i("[draggable!=true]",e.$slideTrack).off("dragstart",e.preventDefault),i(window).off("load.slick.slick-"+e.instanceUid,e.setPosition)},e.prototype.cleanUpSlideEvents=function(){var e=this;e.$list.off("mouseenter.slick",i.proxy(e.interrupt,e,!0)),e.$list.off("mouseleave.slick",i.proxy(e.interrupt,e,!1))},e.prototype.cleanUpRows=function(){var i,e=this;e.options.rows>1&&((i=e.$slides.children().children()).removeAttr("style"),e.$slider.empty().append(i))},e.prototype.clickHandler=function(i){!1===this.shouldClick&&(i.stopImmediatePropagation(),i.stopPropagation(),i.preventDefault())},e.prototype.destroy=function(e){var t=this;t.autoPlayClear(),t.touchObject={},t.cleanUpEvents(),i(".slick-cloned",t.$slider).detach(),t.$dots&&t.$dots.remove(),t.$prevArrow&&t.$prevArrow.length&&(t.$prevArrow.removeClass("slick-disabled slick-arrow slick-hidden").removeAttr("aria-hidden aria-disabled tabindex").css("display",""),t.htmlExpr.test(t.options.prevArrow)&&t.$prevArrow.remove()),t.$nextArrow&&t.$nextArrow.length&&(t.$nextArrow.removeClass("slick-disabled slick-arrow slick-hidden").removeAttr("aria-hidden aria-disabled tabindex").css("display",""),t.htmlExpr.test(t.options.nextArrow)&&t.$nextArrow.remove()),t.$slides&&(t.$slides.removeClass("slick-slide slick-active slick-center slick-visible slick-current").removeAttr("aria-hidden").removeAttr("data-slick-index").each(function(){i(this).attr("style",i(this).data("originalStyling"))}),t.$slideTrack.children(this.options.slide).detach(),t.$slideTrack.detach(),t.$list.detach(),t.$slider.append(t.$slides)),t.cleanUpRows(),t.$slider.removeClass("slick-slider"),t.$slider.removeClass("slick-initialized"),t.$slider.removeClass("slick-dotted"),t.unslicked=!0,e||t.$slider.trigger("destroy",[t])},e.prototype.disableTransition=function(i){var e=this,t={};t[e.transitionType]="",!1===e.options.fade?e.$slideTrack.css(t):e.$slides.eq(i).css(t)},e.prototype.fadeSlide=function(i,e){var t=this;!1===t.cssTransitions?(t.$slides.eq(i).css({zIndex:t.options.zIndex}),t.$slides.eq(i).animate({opacity:1},t.options.speed,t.options.easing,e)):(t.applyTransition(i),t.$slides.eq(i).css({opacity:1,zIndex:t.options.zIndex}),e&&setTimeout(function(){t.disableTransition(i),e.call()},t.options.speed))},e.prototype.fadeSlideOut=function(i){var e=this;!1===e.cssTransitions?e.$slides.eq(i).animate({opacity:0,zIndex:e.options.zIndex-2},e.options.speed,e.options.easing):(e.applyTransition(i),e.$slides.eq(i).css({opacity:0,zIndex:e.options.zIndex-2}))},e.prototype.filterSlides=e.prototype.slickFilter=function(i){var e=this;null!==i&&(e.$slidesCache=e.$slides,e.unload(),e.$slideTrack.children(this.options.slide).detach(),e.$slidesCache.filter(i).appendTo(e.$slideTrack),e.reinit())},e.prototype.focusHandler=function(){var e=this;e.$slider.off("focus.slick blur.slick").on("focus.slick blur.slick","*",function(t){t.stopImmediatePropagation();var o=i(this);setTimeout(function(){e.options.pauseOnFocus&&(e.focussed=o.is(":focus"),e.autoPlay())},0)})},e.prototype.getCurrent=e.prototype.slickCurrentSlide=function(){return this.currentSlide},e.prototype.getDotCount=function(){var i=this,e=0,t=0,o=0;if(!0===i.options.infinite)if(i.slideCount<=i.options.slidesToShow)++o;else for(;e<i.slideCount;)++o,e=t+i.options.slidesToScroll,t+=i.options.slidesToScroll<=i.options.slidesToShow?i.options.slidesToScroll:i.options.slidesToShow;else if(!0===i.options.centerMode)o=i.slideCount;else if(i.options.asNavFor)for(;e<i.slideCount;)++o,e=t+i.options.slidesToScroll,t+=i.options.slidesToScroll<=i.options.slidesToShow?i.options.slidesToScroll:i.options.slidesToShow;else o=1+Math.ceil((i.slideCount-i.options.slidesToShow)/i.options.slidesToScroll);return o-1},e.prototype.getLeft=function(i){var e,t,o,s,n=this,r=0;return n.slideOffset=0,t=n.$slides.first().outerHeight(!0),!0===n.options.infinite?(n.slideCount>n.options.slidesToShow&&(n.slideOffset=n.slideWidth*n.options.slidesToShow*-1,s=-1,!0===n.options.vertical&&!0===n.options.centerMode&&(2===n.options.slidesToShow?s=-1.5:1===n.options.slidesToShow&&(s=-2)),r=t*n.options.slidesToShow*s),n.slideCount%n.options.slidesToScroll!=0&&i+n.options.slidesToScroll>n.slideCount&&n.slideCount>n.options.slidesToShow&&(i>n.slideCount?(n.slideOffset=(n.options.slidesToShow-(i-n.slideCount))*n.slideWidth*-1,r=(n.options.slidesToShow-(i-n.slideCount))*t*-1):(n.slideOffset=n.slideCount%n.options.slidesToScroll*n.slideWidth*-1,r=n.slideCount%n.options.slidesToScroll*t*-1))):i+n.options.slidesToShow>n.slideCount&&(n.slideOffset=(i+n.options.slidesToShow-n.slideCount)*n.slideWidth,r=(i+n.options.slidesToShow-n.slideCount)*t),n.slideCount<=n.options.slidesToShow&&(n.slideOffset=0,r=0),!0===n.options.centerMode&&n.slideCount<=n.options.slidesToShow?n.slideOffset=n.slideWidth*Math.floor(n.options.slidesToShow)/2-n.slideWidth*n.slideCount/2:!0===n.options.centerMode&&!0===n.options.infinite?n.slideOffset+=n.slideWidth*Math.floor(n.options.slidesToShow/2)-n.slideWidth:!0===n.options.centerMode&&(n.slideOffset=0,n.slideOffset+=n.slideWidth*Math.floor(n.options.slidesToShow/2)),e=!1===n.options.vertical?i*n.slideWidth*-1+n.slideOffset:i*t*-1+r,!0===n.options.variableWidth&&(o=n.slideCount<=n.options.slidesToShow||!1===n.options.infinite?n.$slideTrack.children(".slick-slide").eq(i):n.$slideTrack.children(".slick-slide").eq(i+n.options.slidesToShow),e=!0===n.options.rtl?o[0]?-1*(n.$slideTrack.width()-o[0].offsetLeft-o.width()):0:o[0]?-1*o[0].offsetLeft:0,!0===n.options.centerMode&&(o=n.slideCount<=n.options.slidesToShow||!1===n.options.infinite?n.$slideTrack.children(".slick-slide").eq(i):n.$slideTrack.children(".slick-slide").eq(i+n.options.slidesToShow+1),e=!0===n.options.rtl?o[0]?-1*(n.$slideTrack.width()-o[0].offsetLeft-o.width()):0:o[0]?-1*o[0].offsetLeft:0,e+=(n.$list.width()-o.outerWidth())/2)),e},e.prototype.getOption=e.prototype.slickGetOption=function(i){return this.options[i]},e.prototype.getNavigableIndexes=function(){var i,e=this,t=0,o=0,s=[];for(!1===e.options.infinite?i=e.slideCount:(t=-1*e.options.slidesToScroll,o=-1*e.options.slidesToScroll,i=2*e.slideCount);t<i;)s.push(t),t=o+e.options.slidesToScroll,o+=e.options.slidesToScroll<=e.options.slidesToShow?e.options.slidesToScroll:e.options.slidesToShow;return s},e.prototype.getSlick=function(){return this},e.prototype.getSlideCount=function(){var e,t,o=this;return t=!0===o.options.centerMode?o.slideWidth*Math.floor(o.options.slidesToShow/2):0,!0===o.options.swipeToSlide?(o.$slideTrack.find(".slick-slide").each(function(s,n){if(n.offsetLeft-t+i(n).outerWidth()/2>-1*o.swipeLeft)return e=n,!1}),Math.abs(i(e).attr("data-slick-index")-o.currentSlide)||1):o.options.slidesToScroll},e.prototype.goTo=e.prototype.slickGoTo=function(i,e){this.changeSlide({data:{message:"index",index:parseInt(i)}},e)},e.prototype.init=function(e){var t=this;i(t.$slider).hasClass("slick-initialized")||(i(t.$slider).addClass("slick-initialized"),t.buildRows(),t.buildOut(),t.setProps(),t.startLoad(),t.loadSlider(),t.initializeEvents(),t.updateArrows(),t.updateDots(),t.checkResponsive(!0),t.focusHandler()),e&&t.$slider.trigger("init",[t]),!0===t.options.accessibility&&t.initADA(),t.options.autoplay&&(t.paused=!1,t.autoPlay())},e.prototype.initADA=function(){var e=this,t=Math.ceil(e.slideCount/e.options.slidesToShow),o=e.getNavigableIndexes().filter(function(i){return i>=0&&i<e.slideCount});e.$slides.add(e.$slideTrack.find(".slick-cloned")).attr({"aria-hidden":"true",tabindex:"-1"}).find("a, input, button, select").attr({tabindex:"-1"}),null!==e.$dots&&(e.$slides.not(e.$slideTrack.find(".slick-cloned")).each(function(t){var s=o.indexOf(t);i(this).attr({role:"tabpanel",id:"slick-slide"+e.instanceUid+t,tabindex:-1}),-1!==s&&i(this).attr({"aria-describedby":"slick-slide-control"+e.instanceUid+s})}),e.$dots.attr("role","tablist").find("li").each(function(s){var n=o[s];i(this).attr({role:"presentation"}),i(this).find("button").first().attr({role:"tab",id:"slick-slide-control"+e.instanceUid+s,"aria-controls":"slick-slide"+e.instanceUid+n,"aria-label":s+1+" of "+t,"aria-selected":null,tabindex:"-1"})}).eq(e.currentSlide).find("button").attr({"aria-selected":"true",tabindex:"0"}).end());for(var s=e.currentSlide,n=s+e.options.slidesToShow;s<n;s++)e.$slides.eq(s).attr("tabindex",0);e.activateADA()},e.prototype.initArrowEvents=function(){var i=this;!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&(i.$prevArrow.off("click.slick").on("click.slick",{message:"previous"},i.changeSlide),i.$nextArrow.off("click.slick").on("click.slick",{message:"next"},i.changeSlide),!0===i.options.accessibility&&(i.$prevArrow.on("keydown.slick",i.keyHandler),i.$nextArrow.on("keydown.slick",i.keyHandler)))},e.prototype.initDotEvents=function(){var e=this;!0===e.options.dots&&(i("li",e.$dots).on("click.slick",{message:"index"},e.changeSlide),!0===e.options.accessibility&&e.$dots.on("keydown.slick",e.keyHandler)),!0===e.options.dots&&!0===e.options.pauseOnDotsHover&&i("li",e.$dots).on("mouseenter.slick",i.proxy(e.interrupt,e,!0)).on("mouseleave.slick",i.proxy(e.interrupt,e,!1))},e.prototype.initSlideEvents=function(){var e=this;e.options.pauseOnHover&&(e.$list.on("mouseenter.slick",i.proxy(e.interrupt,e,!0)),e.$list.on("mouseleave.slick",i.proxy(e.interrupt,e,!1)))},e.prototype.initializeEvents=function(){var e=this;e.initArrowEvents(),e.initDotEvents(),e.initSlideEvents(),e.$list.on("touchstart.slick mousedown.slick",{action:"start"},e.swipeHandler),e.$list.on("touchmove.slick mousemove.slick",{action:"move"},e.swipeHandler),e.$list.on("touchend.slick mouseup.slick",{action:"end"},e.swipeHandler),e.$list.on("touchcancel.slick mouseleave.slick",{action:"end"},e.swipeHandler),e.$list.on("click.slick",e.clickHandler),i(document).on(e.visibilityChange,i.proxy(e.visibility,e)),!0===e.options.accessibility&&e.$list.on("keydown.slick",e.keyHandler),!0===e.options.focusOnSelect&&i(e.$slideTrack).children().on("click.slick",e.selectHandler),i(window).on("orientationchange.slick.slick-"+e.instanceUid,i.proxy(e.orientationChange,e)),i(window).on("resize.slick.slick-"+e.instanceUid,i.proxy(e.resize,e)),i("[draggable!=true]",e.$slideTrack).on("dragstart",e.preventDefault),i(window).on("load.slick.slick-"+e.instanceUid,e.setPosition),i(e.setPosition)},e.prototype.initUI=function(){var i=this;!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&(i.$prevArrow.show(),i.$nextArrow.show()),!0===i.options.dots&&i.slideCount>i.options.slidesToShow&&i.$dots.show()},e.prototype.keyHandler=function(i){var e=this;i.target.tagName.match("TEXTAREA|INPUT|SELECT")||(37===i.keyCode&&!0===e.options.accessibility?e.changeSlide({data:{message:!0===e.options.rtl?"next":"previous"}}):39===i.keyCode&&!0===e.options.accessibility&&e.changeSlide({data:{message:!0===e.options.rtl?"previous":"next"}}))},e.prototype.lazyLoad=function(){function e(e){i("img[data-lazy]",e).each(function(){var e=i(this),t=i(this).attr("data-lazy"),o=i(this).attr("data-srcset"),s=i(this).attr("data-sizes")||n.$slider.attr("data-sizes"),r=document.createElement("img");r.onload=function(){e.animate({opacity:0},100,function(){o&&(e.attr("srcset",o),s&&e.attr("sizes",s)),e.attr("src",t).animate({opacity:1},200,function(){e.removeAttr("data-lazy data-srcset data-sizes").removeClass("slick-loading")}),n.$slider.trigger("lazyLoaded",[n,e,t])})},r.onerror=function(){e.removeAttr("data-lazy").removeClass("slick-loading").addClass("slick-lazyload-error"),n.$slider.trigger("lazyLoadError",[n,e,t])},r.src=t})}var t,o,s,n=this;if(!0===n.options.centerMode?!0===n.options.infinite?s=(o=n.currentSlide+(n.options.slidesToShow/2+1))+n.options.slidesToShow+2:(o=Math.max(0,n.currentSlide-(n.options.slidesToShow/2+1)),s=n.options.slidesToShow/2+1+2+n.currentSlide):(o=n.options.infinite?n.options.slidesToShow+n.currentSlide:n.currentSlide,s=Math.ceil(o+n.options.slidesToShow),!0===n.options.fade&&(o>0&&o--,s<=n.slideCount&&s++)),t=n.$slider.find(".slick-slide").slice(o,s),"anticipated"===n.options.lazyLoad)for(var r=o-1,l=s,d=n.$slider.find(".slick-slide"),a=0;a<n.options.slidesToScroll;a++)r<0&&(r=n.slideCount-1),t=(t=t.add(d.eq(r))).add(d.eq(l)),r--,l++;e(t),n.slideCount<=n.options.slidesToShow?e(n.$slider.find(".slick-slide")):n.currentSlide>=n.slideCount-n.options.slidesToShow?e(n.$slider.find(".slick-cloned").slice(0,n.options.slidesToShow)):0===n.currentSlide&&e(n.$slider.find(".slick-cloned").slice(-1*n.options.slidesToShow))},e.prototype.loadSlider=function(){var i=this;i.setPosition(),i.$slideTrack.css({opacity:1}),i.$slider.removeClass("slick-loading"),i.initUI(),"progressive"===i.options.lazyLoad&&i.progressiveLazyLoad()},e.prototype.next=e.prototype.slickNext=function(){this.changeSlide({data:{message:"next"}})},e.prototype.orientationChange=function(){var i=this;i.checkResponsive(),i.setPosition()},e.prototype.pause=e.prototype.slickPause=function(){var i=this;i.autoPlayClear(),i.paused=!0},e.prototype.play=e.prototype.slickPlay=function(){var i=this;i.autoPlay(),i.options.autoplay=!0,i.paused=!1,i.focussed=!1,i.interrupted=!1},e.prototype.postSlide=function(e){var t=this;t.unslicked||(t.$slider.trigger("afterChange",[t,e]),t.animating=!1,t.slideCount>t.options.slidesToShow&&t.setPosition(),t.swipeLeft=null,t.options.autoplay&&t.autoPlay(),!0===t.options.accessibility&&(t.initADA(),t.options.focusOnChange&&i(t.$slides.get(t.currentSlide)).attr("tabindex",0).focus()))},e.prototype.prev=e.prototype.slickPrev=function(){this.changeSlide({data:{message:"previous"}})},e.prototype.preventDefault=function(i){i.preventDefault()},e.prototype.progressiveLazyLoad=function(e){e=e||1;var t,o,s,n,r,l=this,d=i("img[data-lazy]",l.$slider);d.length?(t=d.first(),o=t.attr("data-lazy"),s=t.attr("data-srcset"),n=t.attr("data-sizes")||l.$slider.attr("data-sizes"),(r=document.createElement("img")).onload=function(){s&&(t.attr("srcset",s),n&&t.attr("sizes",n)),t.attr("src",o).removeAttr("data-lazy data-srcset data-sizes").removeClass("slick-loading"),!0===l.options.adaptiveHeight&&l.setPosition(),l.$slider.trigger("lazyLoaded",[l,t,o]),l.progressiveLazyLoad()},r.onerror=function(){e<3?setTimeout(function(){l.progressiveLazyLoad(e+1)},500):(t.removeAttr("data-lazy").removeClass("slick-loading").addClass("slick-lazyload-error"),l.$slider.trigger("lazyLoadError",[l,t,o]),l.progressiveLazyLoad())},r.src=o):l.$slider.trigger("allImagesLoaded",[l])},e.prototype.refresh=function(e){var t,o,s=this;o=s.slideCount-s.options.slidesToShow,!s.options.infinite&&s.currentSlide>o&&(s.currentSlide=o),s.slideCount<=s.options.slidesToShow&&(s.currentSlide=0),t=s.currentSlide,s.destroy(!0),i.extend(s,s.initials,{currentSlide:t}),s.init(),e||s.changeSlide({data:{message:"index",index:t}},!1)},e.prototype.registerBreakpoints=function(){var e,t,o,s=this,n=s.options.responsive||null;if("array"===i.type(n)&&n.length){s.respondTo=s.options.respondTo||"window";for(e in n)if(o=s.breakpoints.length-1,n.hasOwnProperty(e)){for(t=n[e].breakpoint;o>=0;)s.breakpoints[o]&&s.breakpoints[o]===t&&s.breakpoints.splice(o,1),o--;s.breakpoints.push(t),s.breakpointSettings[t]=n[e].settings}s.breakpoints.sort(function(i,e){return s.options.mobileFirst?i-e:e-i})}},e.prototype.reinit=function(){var e=this;e.$slides=e.$slideTrack.children(e.options.slide).addClass("slick-slide"),e.slideCount=e.$slides.length,e.currentSlide>=e.slideCount&&0!==e.currentSlide&&(e.currentSlide=e.currentSlide-e.options.slidesToScroll),e.slideCount<=e.options.slidesToShow&&(e.currentSlide=0),e.registerBreakpoints(),e.setProps(),e.setupInfinite(),e.buildArrows(),e.updateArrows(),e.initArrowEvents(),e.buildDots(),e.updateDots(),e.initDotEvents(),e.cleanUpSlideEvents(),e.initSlideEvents(),e.checkResponsive(!1,!0),!0===e.options.focusOnSelect&&i(e.$slideTrack).children().on("click.slick",e.selectHandler),e.setSlideClasses("number"==typeof e.currentSlide?e.currentSlide:0),e.setPosition(),e.focusHandler(),e.paused=!e.options.autoplay,e.autoPlay(),e.$slider.trigger("reInit",[e])},e.prototype.resize=function(){var e=this;i(window).width()!==e.windowWidth&&(clearTimeout(e.windowDelay),e.windowDelay=window.setTimeout(function(){e.windowWidth=i(window).width(),e.checkResponsive(),e.unslicked||e.setPosition()},50))},e.prototype.removeSlide=e.prototype.slickRemove=function(i,e,t){var o=this;if(i="boolean"==typeof i?!0===(e=i)?0:o.slideCount-1:!0===e?--i:i,o.slideCount<1||i<0||i>o.slideCount-1)return!1;o.unload(),!0===t?o.$slideTrack.children().remove():o.$slideTrack.children(this.options.slide).eq(i).remove(),o.$slides=o.$slideTrack.children(this.options.slide),o.$slideTrack.children(this.options.slide).detach(),o.$slideTrack.append(o.$slides),o.$slidesCache=o.$slides,o.reinit()},e.prototype.setCSS=function(i){var e,t,o=this,s={};!0===o.options.rtl&&(i=-i),e="left"==o.positionProp?Math.ceil(i)+"px":"0px",t="top"==o.positionProp?Math.ceil(i)+"px":"0px",s[o.positionProp]=i,!1===o.transformsEnabled?o.$slideTrack.css(s):(s={},!1===o.cssTransitions?(s[o.animType]="translate("+e+", "+t+")",o.$slideTrack.css(s)):(s[o.animType]="translate3d("+e+", "+t+", 0px)",o.$slideTrack.css(s)))},e.prototype.setDimensions=function(){var i=this;!1===i.options.vertical?!0===i.options.centerMode&&i.$list.css({padding:"0px "+i.options.centerPadding}):(i.$list.height(i.$slides.first().outerHeight(!0)*i.options.slidesToShow),!0===i.options.centerMode&&i.$list.css({padding:i.options.centerPadding+" 0px"})),i.listWidth=i.$list.width(),i.listHeight=i.$list.height(),!1===i.options.vertical&&!1===i.options.variableWidth?(i.slideWidth=Math.ceil(i.listWidth/i.options.slidesToShow),i.$slideTrack.width(Math.ceil(i.slideWidth*i.$slideTrack.children(".slick-slide").length))):!0===i.options.variableWidth?i.$slideTrack.width(5e3*i.slideCount):(i.slideWidth=Math.ceil(i.listWidth),i.$slideTrack.height(Math.ceil(i.$slides.first().outerHeight(!0)*i.$slideTrack.children(".slick-slide").length)));var e=i.$slides.first().outerWidth(!0)-i.$slides.first().width();!1===i.options.variableWidth&&i.$slideTrack.children(".slick-slide").width(i.slideWidth-e)},e.prototype.setFade=function(){var e,t=this;t.$slides.each(function(o,s){e=t.slideWidth*o*-1,!0===t.options.rtl?i(s).css({position:"relative",right:e,top:0,zIndex:t.options.zIndex-2,opacity:0}):i(s).css({position:"relative",left:e,top:0,zIndex:t.options.zIndex-2,opacity:0})}),t.$slides.eq(t.currentSlide).css({zIndex:t.options.zIndex-1,opacity:1})},e.prototype.setHeight=function(){var i=this;if(1===i.options.slidesToShow&&!0===i.options.adaptiveHeight&&!1===i.options.vertical){var e=i.$slides.eq(i.currentSlide).outerHeight(!0);i.$list.css("height",e)}},e.prototype.setOption=e.prototype.slickSetOption=function(){var e,t,o,s,n,r=this,l=!1;if("object"===i.type(arguments[0])?(o=arguments[0],l=arguments[1],n="multiple"):"string"===i.type(arguments[0])&&(o=arguments[0],s=arguments[1],l=arguments[2],"responsive"===arguments[0]&&"array"===i.type(arguments[1])?n="responsive":void 0!==arguments[1]&&(n="single")),"single"===n)r.options[o]=s;else if("multiple"===n)i.each(o,function(i,e){r.options[i]=e});else if("responsive"===n)for(t in s)if("array"!==i.type(r.options.responsive))r.options.responsive=[s[t]];else{for(e=r.options.responsive.length-1;e>=0;)r.options.responsive[e].breakpoint===s[t].breakpoint&&r.options.responsive.splice(e,1),e--;r.options.responsive.push(s[t])}l&&(r.unload(),r.reinit())},e.prototype.setPosition=function(){var i=this;i.setDimensions(),i.setHeight(),!1===i.options.fade?i.setCSS(i.getLeft(i.currentSlide)):i.setFade(),i.$slider.trigger("setPosition",[i])},e.prototype.setProps=function(){var i=this,e=document.body.style;i.positionProp=!0===i.options.vertical?"top":"left","top"===i.positionProp?i.$slider.addClass("slick-vertical"):i.$slider.removeClass("slick-vertical"),void 0===e.WebkitTransition&&void 0===e.MozTransition&&void 0===e.msTransition||!0===i.options.useCSS&&(i.cssTransitions=!0),i.options.fade&&("number"==typeof i.options.zIndex?i.options.zIndex<3&&(i.options.zIndex=3):i.options.zIndex=i.defaults.zIndex),void 0!==e.OTransform&&(i.animType="OTransform",i.transformType="-o-transform",i.transitionType="OTransition",void 0===e.perspectiveProperty&&void 0===e.webkitPerspective&&(i.animType=!1)),void 0!==e.MozTransform&&(i.animType="MozTransform",i.transformType="-moz-transform",i.transitionType="MozTransition",void 0===e.perspectiveProperty&&void 0===e.MozPerspective&&(i.animType=!1)),void 0!==e.webkitTransform&&(i.animType="webkitTransform",i.transformType="-webkit-transform",i.transitionType="webkitTransition",void 0===e.perspectiveProperty&&void 0===e.webkitPerspective&&(i.animType=!1)),void 0!==e.msTransform&&(i.animType="msTransform",i.transformType="-ms-transform",i.transitionType="msTransition",void 0===e.msTransform&&(i.animType=!1)),void 0!==e.transform&&!1!==i.animType&&(i.animType="transform",i.transformType="transform",i.transitionType="transition"),i.transformsEnabled=i.options.useTransform&&null!==i.animType&&!1!==i.animType},e.prototype.setSlideClasses=function(i){var e,t,o,s,n=this;if(t=n.$slider.find(".slick-slide").removeClass("slick-active slick-center slick-current").attr("aria-hidden","true"),n.$slides.eq(i).addClass("slick-current"),!0===n.options.centerMode){var r=n.options.slidesToShow%2==0?1:0;e=Math.floor(n.options.slidesToShow/2),!0===n.options.infinite&&(i>=e&&i<=n.slideCount-1-e?n.$slides.slice(i-e+r,i+e+1).addClass("slick-active").attr("aria-hidden","false"):(o=n.options.slidesToShow+i,t.slice(o-e+1+r,o+e+2).addClass("slick-active").attr("aria-hidden","false")),0===i?t.eq(t.length-1-n.options.slidesToShow).addClass("slick-center"):i===n.slideCount-1&&t.eq(n.options.slidesToShow).addClass("slick-center")),n.$slides.eq(i).addClass("slick-center")}else i>=0&&i<=n.slideCount-n.options.slidesToShow?n.$slides.slice(i,i+n.options.slidesToShow).addClass("slick-active").attr("aria-hidden","false"):t.length<=n.options.slidesToShow?t.addClass("slick-active").attr("aria-hidden","false"):(s=n.slideCount%n.options.slidesToShow,o=!0===n.options.infinite?n.options.slidesToShow+i:i,n.options.slidesToShow==n.options.slidesToScroll&&n.slideCount-i<n.options.slidesToShow?t.slice(o-(n.options.slidesToShow-s),o+s).addClass("slick-active").attr("aria-hidden","false"):t.slice(o,o+n.options.slidesToShow).addClass("slick-active").attr("aria-hidden","false"));"ondemand"!==n.options.lazyLoad&&"anticipated"!==n.options.lazyLoad||n.lazyLoad()},e.prototype.setupInfinite=function(){var e,t,o,s=this;if(!0===s.options.fade&&(s.options.centerMode=!1),!0===s.options.infinite&&!1===s.options.fade&&(t=null,s.slideCount>s.options.slidesToShow)){for(o=!0===s.options.centerMode?s.options.slidesToShow+1:s.options.slidesToShow,e=s.slideCount;e>s.slideCount-o;e-=1)t=e-1,i(s.$slides[t]).clone(!0).attr("id","").attr("data-slick-index",t-s.slideCount).prependTo(s.$slideTrack).addClass("slick-cloned");for(e=0;e<o+s.slideCount;e+=1)t=e,i(s.$slides[t]).clone(!0).attr("id","").attr("data-slick-index",t+s.slideCount).appendTo(s.$slideTrack).addClass("slick-cloned");s.$slideTrack.find(".slick-cloned").find("[id]").each(function(){i(this).attr("id","")})}},e.prototype.interrupt=function(i){var e=this;i||e.autoPlay(),e.interrupted=i},e.prototype.selectHandler=function(e){var t=this,o=i(e.target).is(".slick-slide")?i(e.target):i(e.target).parents(".slick-slide"),s=parseInt(o.attr("data-slick-index"));s||(s=0),t.slideCount<=t.options.slidesToShow?t.slideHandler(s,!1,!0):t.slideHandler(s)},e.prototype.slideHandler=function(i,e,t){var o,s,n,r,l,d=null,a=this;if(e=e||!1,!(!0===a.animating&&!0===a.options.waitForAnimate||!0===a.options.fade&&a.currentSlide===i))if(!1===e&&a.asNavFor(i),o=i,d=a.getLeft(o),r=a.getLeft(a.currentSlide),a.currentLeft=null===a.swipeLeft?r:a.swipeLeft,!1===a.options.infinite&&!1===a.options.centerMode&&(i<0||i>a.getDotCount()*a.options.slidesToScroll))!1===a.options.fade&&(o=a.currentSlide,!0!==t?a.animateSlide(r,function(){a.postSlide(o)}):a.postSlide(o));else if(!1===a.options.infinite&&!0===a.options.centerMode&&(i<0||i>a.slideCount-a.options.slidesToScroll))!1===a.options.fade&&(o=a.currentSlide,!0!==t?a.animateSlide(r,function(){a.postSlide(o)}):a.postSlide(o));else{if(a.options.autoplay&&clearInterval(a.autoPlayTimer),s=o<0?a.slideCount%a.options.slidesToScroll!=0?a.slideCount-a.slideCount%a.options.slidesToScroll:a.slideCount+o:o>=a.slideCount?a.slideCount%a.options.slidesToScroll!=0?0:o-a.slideCount:o,a.animating=!0,a.$slider.trigger("beforeChange",[a,a.currentSlide,s]),n=a.currentSlide,a.currentSlide=s,a.setSlideClasses(a.currentSlide),a.options.asNavFor&&(l=(l=a.getNavTarget()).slick("getSlick")).slideCount<=l.options.slidesToShow&&l.setSlideClasses(a.currentSlide),a.updateDots(),a.updateArrows(),!0===a.options.fade)return!0!==t?(a.fadeSlideOut(n),a.fadeSlide(s,function(){a.postSlide(s)})):a.postSlide(s),void a.animateHeight();!0!==t?a.animateSlide(d,function(){a.postSlide(s)}):a.postSlide(s)}},e.prototype.startLoad=function(){var i=this;!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&(i.$prevArrow.hide(),i.$nextArrow.hide()),!0===i.options.dots&&i.slideCount>i.options.slidesToShow&&i.$dots.hide(),i.$slider.addClass("slick-loading")},e.prototype.swipeDirection=function(){var i,e,t,o,s=this;return i=s.touchObject.startX-s.touchObject.curX,e=s.touchObject.startY-s.touchObject.curY,t=Math.atan2(e,i),(o=Math.round(180*t/Math.PI))<0&&(o=360-Math.abs(o)),o<=45&&o>=0?!1===s.options.rtl?"left":"right":o<=360&&o>=315?!1===s.options.rtl?"left":"right":o>=135&&o<=225?!1===s.options.rtl?"right":"left":!0===s.options.verticalSwiping?o>=35&&o<=135?"down":"up":"vertical"},e.prototype.swipeEnd=function(i){var e,t,o=this;if(o.dragging=!1,o.swiping=!1,o.scrolling)return o.scrolling=!1,!1;if(o.interrupted=!1,o.shouldClick=!(o.touchObject.swipeLength>10),void 0===o.touchObject.curX)return!1;if(!0===o.touchObject.edgeHit&&o.$slider.trigger("edge",[o,o.swipeDirection()]),o.touchObject.swipeLength>=o.touchObject.minSwipe){switch(t=o.swipeDirection()){case"left":case"down":e=o.options.swipeToSlide?o.checkNavigable(o.currentSlide+o.getSlideCount()):o.currentSlide+o.getSlideCount(),o.currentDirection=0;break;case"right":case"up":e=o.options.swipeToSlide?o.checkNavigable(o.currentSlide-o.getSlideCount()):o.currentSlide-o.getSlideCount(),o.currentDirection=1}"vertical"!=t&&(o.slideHandler(e),o.touchObject={},o.$slider.trigger("swipe",[o,t]))}else o.touchObject.startX!==o.touchObject.curX&&(o.slideHandler(o.currentSlide),o.touchObject={})},e.prototype.swipeHandler=function(i){var e=this;if(!(!1===e.options.swipe||"ontouchend"in document&&!1===e.options.swipe||!1===e.options.draggable&&-1!==i.type.indexOf("mouse")))switch(e.touchObject.fingerCount=i.originalEvent&&void 0!==i.originalEvent.touches?i.originalEvent.touches.length:1,e.touchObject.minSwipe=e.listWidth/e.options.touchThreshold,!0===e.options.verticalSwiping&&(e.touchObject.minSwipe=e.listHeight/e.options.touchThreshold),i.data.action){case"start":e.swipeStart(i);break;case"move":e.swipeMove(i);break;case"end":e.swipeEnd(i)}},e.prototype.swipeMove=function(i){var e,t,o,s,n,r,l=this;return n=void 0!==i.originalEvent?i.originalEvent.touches:null,!(!l.dragging||l.scrolling||n&&1!==n.length)&&(e=l.getLeft(l.currentSlide),l.touchObject.curX=void 0!==n?n[0].pageX:i.clientX,l.touchObject.curY=void 0!==n?n[0].pageY:i.clientY,l.touchObject.swipeLength=Math.round(Math.sqrt(Math.pow(l.touchObject.curX-l.touchObject.startX,2))),r=Math.round(Math.sqrt(Math.pow(l.touchObject.curY-l.touchObject.startY,2))),!l.options.verticalSwiping&&!l.swiping&&r>4?(l.scrolling=!0,!1):(!0===l.options.verticalSwiping&&(l.touchObject.swipeLength=r),t=l.swipeDirection(),void 0!==i.originalEvent&&l.touchObject.swipeLength>4&&(l.swiping=!0,i.preventDefault()),s=(!1===l.options.rtl?1:-1)*(l.touchObject.curX>l.touchObject.startX?1:-1),!0===l.options.verticalSwiping&&(s=l.touchObject.curY>l.touchObject.startY?1:-1),o=l.touchObject.swipeLength,l.touchObject.edgeHit=!1,!1===l.options.infinite&&(0===l.currentSlide&&"right"===t||l.currentSlide>=l.getDotCount()&&"left"===t)&&(o=l.touchObject.swipeLength*l.options.edgeFriction,l.touchObject.edgeHit=!0),!1===l.options.vertical?l.swipeLeft=e+o*s:l.swipeLeft=e+o*(l.$list.height()/l.listWidth)*s,!0===l.options.verticalSwiping&&(l.swipeLeft=e+o*s),!0!==l.options.fade&&!1!==l.options.touchMove&&(!0===l.animating?(l.swipeLeft=null,!1):void l.setCSS(l.swipeLeft))))},e.prototype.swipeStart=function(i){var e,t=this;if(t.interrupted=!0,1!==t.touchObject.fingerCount||t.slideCount<=t.options.slidesToShow)return t.touchObject={},!1;void 0!==i.originalEvent&&void 0!==i.originalEvent.touches&&(e=i.originalEvent.touches[0]),t.touchObject.startX=t.touchObject.curX=void 0!==e?e.pageX:i.clientX,t.touchObject.startY=t.touchObject.curY=void 0!==e?e.pageY:i.clientY,t.dragging=!0},e.prototype.unfilterSlides=e.prototype.slickUnfilter=function(){var i=this;null!==i.$slidesCache&&(i.unload(),i.$slideTrack.children(this.options.slide).detach(),i.$slidesCache.appendTo(i.$slideTrack),i.reinit())},e.prototype.unload=function(){var e=this;i(".slick-cloned",e.$slider).remove(),e.$dots&&e.$dots.remove(),e.$prevArrow&&e.htmlExpr.test(e.options.prevArrow)&&e.$prevArrow.remove(),e.$nextArrow&&e.htmlExpr.test(e.options.nextArrow)&&e.$nextArrow.remove(),e.$slides.removeClass("slick-slide slick-active slick-visible slick-current").attr("aria-hidden","true").css("width","")},e.prototype.unslick=function(i){var e=this;e.$slider.trigger("unslick",[e,i]),e.destroy()},e.prototype.updateArrows=function(){var i=this;Math.floor(i.options.slidesToShow/2),!0===i.options.arrows&&i.slideCount>i.options.slidesToShow&&!i.options.infinite&&(i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false"),i.$nextArrow.removeClass("slick-disabled").attr("aria-disabled","false"),0===i.currentSlide?(i.$prevArrow.addClass("slick-disabled").attr("aria-disabled","true"),i.$nextArrow.removeClass("slick-disabled").attr("aria-disabled","false")):i.currentSlide>=i.slideCount-i.options.slidesToShow&&!1===i.options.centerMode?(i.$nextArrow.addClass("slick-disabled").attr("aria-disabled","true"),i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false")):i.currentSlide>=i.slideCount-1&&!0===i.options.centerMode&&(i.$nextArrow.addClass("slick-disabled").attr("aria-disabled","true"),i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled","false")))},e.prototype.updateDots=function(){var i=this;null!==i.$dots&&(i.$dots.find("li").removeClass("slick-active").end(),i.$dots.find("li").eq(Math.floor(i.currentSlide/i.options.slidesToScroll)).addClass("slick-active"))},e.prototype.visibility=function(){var i=this;i.options.autoplay&&(document[i.hidden]?i.interrupted=!0:i.interrupted=!1)},i.fn.slick=function(){var i,t,o=this,s=arguments[0],n=Array.prototype.slice.call(arguments,1),r=o.length;for(i=0;i<r;i++)if("object"==typeof s||void 0===s?o[i].slick=new e(o[i],s):t=o[i].slick[s].apply(o[i].slick,n),void 0!==t)return t;return o}});

$( document ).ready( function () {

	//resizes all items to the same size as the largest item
	var resizeItems = function ( $items ) {
		var largestHeight = 0;
		$items.css( 'height', '' );
		$items.css( 'min-height', '' );

		$items.each( function () {
			var height = $( this ).height();
			if ( height > largestHeight ) {
				largestHeight = height;
			}
		} );
		$items.height(largestHeight);
		$items.css('min-height', largestHeight);
	};

	$( '.long-card-group-wrapper' ).each( function () {
		var $this = $( this );
		var $longCards = $this.find( '.long-card-container' );
		var $longCardTops = $longCards.find( '.long-card-top' );

		// make the group a carousel
		if ( $this.hasClass( '-slick' ) ) {
			$( this ).slick( {
				arrows: false,
				variableWidth: true,
				infinite: false
			} );
			$( '.arrow.-left' ).on( 'click', function () {
				$this.slick( 'slickPrev' );
			} );
			$( '.arrow.-right' ).on( 'click', function () {
				$this.slick( 'slickNext' )
			} );

			$( window ).on( 'resize load', function () {
				resizeItems( $longCardTops );
				resizeItems( $longCards );
			} );
		} else {
			$( window ).on( 'resize load', function () {
				resizeItems( $longCardTops );
			} );
		}
	} );
} );
$( document ).ready( function () {
	$( 'body' ).on( 'click', '.login-alerts .icon-close', function () {
		var loginAlertItem = $( this ).parent();
		var alertIndex = loginAlertItem.data( 'alert-index' );
		loginAlertItem.addClass( '_hidden' );
		//Hide all instances of the alert model when closed for mobile and desktop
		$(".login-alerts-item[data-alert-index="+alertIndex+"]").addClass('_hidden');
	} );
} );
/*global
    encode_deviceprint
    Cookies
 */
$( document ).ready( function () {
	'use strict';

	// TODO clean up this file to match the js patterns
	var $loginComponents = $( '.login-container.component' );
	var $body = $( 'body' );

	var setDevicePrint = function () {
		var $loginComponent = $( this );
		var $loginForm = $loginComponent.find( '.login-form' );
		var dpEncoding = encode_deviceprint();
		var $devicePrint = $loginForm.find( '.device-print' );
		$devicePrint.attr( 'value', dpEncoding );
	};

	var bindMenuItemHover = function () {
		$( '.dropdown-menu-link' ).on( 'mouseover', function () {
			$( this ).focus();
		} );
	};

	var validateInput = function ( input, message ) {
		var valid = true;
		var $errorMessage = input.parents( '.login-form-container' ).find( '.form-error-message' );
		var labelElement = input.parent().children( 'label' );
		var value = input.val().trim();
		var minLength = input.attr( 'minlength' );
		var maxLength = input.attr( 'maxlength' );

		if ( !message ) {
			message = '';
		}

		if ( minLength > value.length || maxLength < value.length ) {
			message += '<p>The length of ' + labelElement.text() + ' is invalid. It must be between ' + minLength + ' and ' + maxLength + ' characters in length.</p>';
			valid = false;
		}
		if ( valid ) {
			$errorMessage.text( '' );
			$errorMessage.parent().addClass( '_hidden' );
		} else {
			$errorMessage.parent().removeClass( '_hidden' );
			$errorMessage.html( message );
		}
		return valid;
	};

	var validateForm = function ( form ) {
		var valid = true;
		var message = '&nbsp;';
		$( '[required]' ).filter( ':visible' ).each( function () {
			if ( !validateInput( $( this, message ) ) ) {
				message = form.find( '.form-error-message' ).html();
				valid = false;
			}
		} );
		return valid;
	};

	var bindDropdownMenu = function ( _dropdown ) {
		var $dropdownMenu = $( '.-dropdown-menu' );
		var $dropdownMenuTrigger = $( '.dropdown-menu-trigger.' + _dropdown );
		var $dropdownMenuTarget = $( '.dropdown-menu-target.' + _dropdown + '-dropdown' );
		var $dropdownMenuBoth = $( '.dropdown-menu-trigger.' + _dropdown + ',.dropdown-menu-target.' + _dropdown + '-dropdown' );
		var $dropdownMenuLink = $dropdownMenuTarget.find( '.dropdown-menu-link' );
		var $dropdownMenuClose = $dropdownMenu.find( '.dropdown-menu-link.-close' );
		var doShowHide = false;

		if ( typeof $dropdownMenu !== -1 ) {
			$dropdownMenuBoth.on( 'click touchstart', function ( e ) {
				e.preventDefault();

				if( e.type == "touchstart" ) {
					doShowHide = true;
				} else if( e.type == "click" ) {
					doShowHide = true;
				}
				if( doShowHide ) {
					if ( $dropdownMenuTarget.hasClass( '_hidden' ) ) {
						$dropdownMenuTarget.removeClass( '_hidden' );
						$dropdownMenuTrigger.removeClass( '-down' ).addClass( '-up' ).attr( 'aria-expanded', 'true' );
						$dropdownMenuLink.attr( 'tabindex', '0' ).first().focus();
						$dropdownMenuLink.attr( 'aria-hidden', 'false' );
					} else if ( !$dropdownMenuTarget.hasClass( '_hidden' ) ) {
						setTimeout( function () {
							$dropdownMenuLink.attr( 'tabindex', '-1' );
							$dropdownMenuLink.attr( 'aria-hidden', 'true' );
							$dropdownMenuTarget.addClass( '_hidden' );
							$dropdownMenuTrigger.removeClass( '-up' ).addClass( '-down' ).attr( 'aria-expanded', 'false' ).focus();
						}, 300 );
					}
					doShowHide = false;
				}
			} );
			$dropdownMenuClose.on( 'click touchstart', function ( e ) {
				e.preventDefault();

				$dropdownMenuLink.attr( 'tabindex', '-1' );
				$dropdownMenuLink.attr( 'aria-hidden', 'true' );
				$dropdownMenuTarget.addClass( '_hidden' );
				$dropdownMenuTrigger.removeClass( '-up' ).addClass( '-down' ).attr( 'aria-expanded', 'false' ).focus();
			} );
			$dropdownMenuLink.on( 'click touchstart', function ( e ) {
				e.preventDefault();
				var $this = $( this );

				if( ! $this.hasClass( '-close' ) ) {
					$this.addClass( '-clicked' );

					setTimeout( function () {
						window.location.href = $this.attr( 'href' );
					}, 300 );
				}
			} );
			$dropdownMenuTarget.on( 'focusout', function () {
				if ( $body.width() >= 1023 ) {
					setTimeout( function () {
						if ( $( ':focus' ).closest( $dropdownMenuTarget ).length <= 0 ) {
							$dropdownMenuLink.attr( 'tabindex', '0' );
							$dropdownMenuLink.attr( 'aria-hidden', 'true' );
							$dropdownMenuTarget.addClass( '_hidden' );
							$dropdownMenuTrigger.removeClass( '-up' ).addClass( '-down' ).attr( 'aria-expanded', 'false' );
						}
					}, 0 );
				}
			} );
		}
	};

	var focusInput = function ( input ) {
		var labelId = $( input ).attr( 'id' );
		var $label = $( 'label[for=\'' + labelId + '\']' );

		$label.addClass( '-to-top' );
		$( input ).attr( 'aria-invalid', 'false' );
	};
	var blurInput = function ( input ) {
		var labelId = $( input ).attr( 'id' );
		var $label = $( 'label[for=\'' + labelId + '\']' );

		if ( !$( input ).val() ) {
			$label.removeClass( '-to-top' );
		}
		validateInput( $( input ) );
	};

	var bindLoginInputFields = function () {
		var $loginField = $( '.login-field' );

		if ( $loginField.length ) {
			$loginField.on( 'focus', function () {
				focusInput( this );
			} );
			$loginField.on( 'blur', function () {
				blurInput( this );
			} );
		}
	};

	var getSelectedOption = function ( $loginComponent ) {
		return $loginComponent.find( '.login-form-selection .option.-active' ).data( 'option' );
	};

	var toggleSignUpLink = function ( _tab ) {
		var $signUpLink = $( '.login-link.-sign-up' );
		var $linkStatus = $signUpLink.data( _tab );
		var $signUpTitle = $signUpLink.data( _tab + '-title' );
		var $signUpUrl = $signUpLink.data( _tab + '-url' );

		if ( $linkStatus ) {
			$signUpLink.removeClass( '_hidden' );
		} else {
			$signUpLink.addClass( '_hidden' );
		}

		// Reset
		$signUpLink.attr( 'href', '' ).text( '' );

		$signUpLink.attr( 'href', $signUpUrl ).text( $signUpTitle );
	};

	var setFormAction = function () {
		var $loginFormComponent = $( '.login-form-container.component' );
		var $loginForm = $loginFormComponent.find( '.login-form' );
		var $personalForm = $loginFormComponent.find( '.-personal-business' );
		var $commercialForm = $loginFormComponent.find( '.-commercial' );

		if ( $loginForm ) {
			if ( 'dealer' === getSelectedOption( $loginFormComponent ) ) {
				// commercial login
				$personalForm.addClass( '_hidden' );
				$personalForm.attr( 'hidden', 'true' );
				$commercialForm.removeClass( '_hidden' );
				$commercialForm.removeAttr( 'hidden' );
				$commercialForm.find( 'input, button, .cta-button, a' ).removeAttr( 'aria-hidden' ).removeAttr( 'tabindex' );
				toggleSignUpLink( 'commercial' );
			} else {
				// user login
				$commercialForm.addClass( '_hidden' );
				$commercialForm.attr( 'hidden', 'true' );
				$personalForm.removeClass( '_hidden' );
				$personalForm.removeAttr( 'hidden' );
				$personalForm.find( 'input, button, .cta-button, a' ).removeAttr( 'aria-hidden' ).removeAttr( 'tabindex' );
				toggleSignUpLink( 'personal-business' );
			}
		}
	};

	var bindLandingPageOptions = function () {
		var $loginFormSelection = $( '.login-form-selection' );
		if ( $loginFormSelection.find( '.option.-active' ).length === 0 ) {
			$loginFormSelection.find( '.option' ).filter( '[data-option="user"]' ).addClass( '-active' );
		}

		if ( typeof $loginFormSelection !== -1 ) {
			$loginFormSelection.find( '.option' ).on( 'click', function () {
				var $this = $( this );
				var option = $this.attr( 'data-option' );
				var $allOptions = $loginFormSelection.find( '.option' );
				var $clickedOption = $loginFormSelection.find( '.option[data-option=' + option + ']' );
				// cleanup
				$allOptions.removeClass( '-active' );
				$allOptions.attr( 'aria-pressed', 'false' );
				$clickedOption.addClass( '-active' );
				$clickedOption.attr( 'aria-pressed', 'true' );

				setFormAction();
			} );
		}
	};

	var trackTealiumClickEvent = function ( $event ) {
		var $element = $event.target;
		Utils.tealium.trackEvent({
			tealium_event : 'clickAction',
			customLinkName: $element.innerText,
			componentName: 'login'
		});
	}

	var trackTealiumLoginEvent = function ( $isValidLogin, $loginTab ) {
		if ( $isValidLogin ) {
			Utils.tealium.trackEvent({
				tealium_event: 'successfulLogin',
				customLinkName: 'Log In',
				componentName: 'login',
				mtbLoginType: $loginTab
			});
		} else {
			Utils.tealium.trackEvent({
				tealium_event: 'failedLogin',
				customLinkName: 'Log In',
				componentName: 'login',
				mtbLoginType: $loginTab
			});
		}
	};

	$body.on( 'submit', '.login-form', function ( e ) {
		var $this = $( this );
		var $loginTab = $( '.login-form-selection button.-active' )[0].innerText;
		if ( !validateForm( this ) ) {
			e.preventDefault();
			trackTealiumLoginEvent(false, $loginTab );
		} else {
			trackTealiumLoginEvent(true, $loginTab );
			if ( $( '#login-checkbox' ).is( ':checked' ) && $this.closest( '.-personal-business' ).length > 0 ) {
				document.cookie = "OLBRememberUserId=" + $( '#txtUserID' ).val() + ";";
			} else if ( $( '#commercial-login-checkbox' ).is( ':checked' ) && $this.closest( '.-commercial' ).length > 0 ) {
				document.cookie = "user-id=" + $( '#loginId' ).val() + ";";
			}
		}
	} );

	//Tealium: Bind Click Events for tabs and text links
	$body.on( 'click', '.login-form-selection button, .login-link', trackTealiumClickEvent );

	var retrieveCookie = function () {
		var personalUsername = Cookies.get( 'OLBRememberUserId' );
		var commercialUsername = Cookies.get( 'user-id' );
		var $personalUsernameInput = $( '#txtUserID' );
		var $commercialUsernameInput = $( '#loginId' );
		var $loginFormSelection = $( '.login-form-selection' );

		$personalUsernameInput.val( personalUsername );
		$commercialUsernameInput.val( commercialUsername );

		if ( personalUsername ) {
			focusInput( $personalUsernameInput );
			$( '#login-checkbox' ).prop( 'checked', true );
		} else if ( commercialUsername ) {
			focusInput( $commercialUsernameInput );
			$( '#commercial-login-checkbox' ).prop( 'checked', true );
			$loginFormSelection.find( '.option' ).removeClass( '-active' );
			$loginFormSelection.find( '.option' ).attr( 'aria-pressed', 'false' );
			$loginFormSelection.find( '.option[data-option=dealer]' ).addClass( '-active' );
			$loginFormSelection.find( '.option[data-option=dealer]' ).attr( 'aria-pressed', 'true' );
			setFormAction();
		}
	};

	$loginComponents.each( function () {
		setDevicePrint();
		retrieveCookie();
	} );

	bindDropdownMenu( '-personal-business' );
	bindDropdownMenu( '-commercial' );
	toggleSignUpLink( 'personal-business' );
	bindLandingPageOptions();
	bindLoginInputFields();
	bindMenuItemHover();
} );

$( document ).ready( function () {
	
	var $homepageHeroComponents = $( '.homepage-hero-wrapper.component' );
	
	var adjustForSize = function(homepageContainer) {
		var background;
		if ( window.innerWidth <= 768 ) {
			// add -mobile class and set the background image to the mobile image
			background = homepageContainer.data( 'mobile-background' );
			homepageContainer.addClass( '-mobile' );
			if ( background && background.length ) {
				homepageContainer.css( 'background-image', 'url("' + background + '")' );
			}
		} else {
			// remove the -mobile class and set the background image to the desktop image
			background = homepageContainer.data( 'desktop-background' );
			homepageContainer.removeClass( '-mobile' );
			homepageContainer.css( 'background-image', 'url("' + background + '")' );
		}
	};
	
	$homepageHeroComponents.each(function () {
		var $homepageHeroComponent = $(this);
		var $homepageHeroContainer = $homepageHeroComponent.find('.homepage-hero-container');

		$homepageHeroContainer.each( function () {
			var $this = $( this );
			adjustForSize( $this );
		})
	});
	
	// TODO handle window resize in global util, then fire a different event that
	$( window ).on( 'resize', function () {
		if( $homepageHeroComponents.length > 0 ){
			$homepageHeroComponents.each( function(){
				var $this = $( this );
				var $homePageContainers = $this.find( '.homepage-hero-container' );
				$homePageContainers.each( function(){
					var $container = $( this );
					adjustForSize( $container );
				});
			});
		}
	} );
	
});

$(document).ready( function (  ) {
	var $window = $( window );
	var $heroComponents = $('.hero.component');
	var mobileBreakpoint = 768;

	var setBackground = function() {
		$heroComponents.each( function(){
			var $heroComponent = $(this);
			var mobileBackground = $heroComponent.data( 'mobile-image' );
			var desktopBackground = $heroComponent.data( 'desktop-image' );
			$heroComponent.css( 'background-image', 'url("' + desktopBackground + '")' );
			if( window.outerWidth <= mobileBreakpoint && mobileBackground ){
				$heroComponent.css( 'background-image', 'url("' + mobileBackground + '")' );
			}
		});
	}

	$window.on( 'resize', setBackground);

	setBackground();
});

$( document ).ready( function () {
	
	var $helpCenterComponents = $('.help-center-container.component');
	
	$helpCenterComponents.each(function () {
		// TODO do component stuff in here please!
	});
	
	/******************************************************************************
	 *
	 * TODO Everything beneath this point needs to be refactored when there is time
	 *
	 *****************************************************************************/
	
	// TODO refactor this when there is time
	var $helpCenterSearchField = $( '.help-center-search-field' );
	
	// TODO refactor this when there is time
	var $body = $( 'body' );
	
	// TODO refactor this when there is time
	$helpCenterSearchField.on( 'focus', function () {
		$( this ).siblings( '.search-label' ).addClass( '-to-top' );
	} );
	
	// TODO refactor this when there is time
	$helpCenterSearchField.on( 'blur', function () {
		if ( $( this ).val().length === 0 ) {
			$( this ).siblings( '.search-label' ).removeClass( '-to-top' );
		}
	} );
	
	// TODO refactor this when there is time
	var searchModalSubmit = function ( e ) {
		e.preventDefault();
		$( 'body .search-results-items' ).empty();
		$( 'body .help-center-search-field' ).each( function () {
			var helpInputValue = $( this ).val();
			if ( helpInputValue != '' ) {
				$( 'body #searchInput' ).val( helpInputValue );
				$( 'body .search-results-icon-magnifying-glass' ).trigger( 'click' );
			}
		} );
	}
	
	// TODO refactor this when there is time
	$body.on( 'keypress', '.help-center-search-field', function ( e ) {
		if ( e.which === 13 ) {
			$( 'body .help-center-icon-magnifying-glass-link' ).trigger( 'click' );
		}
	} );
	
	// TODO refactor this when there is time
	$body.on( 'click', '.help-center-icon-magnifying-glass-link', function ( e ) {
		searchModalSubmit( e );
	} );

} );

$(document).ready(function(){
	$('.form-component').each(function ( ) {
		var $this = $(this);
		var flexClass = '-flex-1';

		switch($this.attr('data-form-flex')){
			case "2":
				flexClass = '-flex-2';
				break;
			case "3":
				flexClass = '-flex-3';
				break;
			case "4":
				flexClass = '-flex-4';
				break;
			case "5":
				flexClass = '-flex-5';
				break;
		}

		$this.parent().addClass(flexClass);
	});
});
$( document ).ready( function () {
	var $formComponents = $( '.form-container.component' );

	$formComponents.each( function () {
		var formComponent = this;
		var $formComponent = $( this );
		var $nextButton = $formComponent.find( '.next-button' );

		$nextButton.on( 'click', function ( e ) {
			if ( formComponent.checkValidity() ) {
				var $formModalBackground = $formComponent.find( '.modal-background' );
				var $formSubmitModal = $formComponent.find( '.submit-modal' );

				var closeModal = function () {
					$formSubmitModal.removeClass( '-open' );
					$formModalBackground.hide();
				};
				$formModalBackground.on( 'click', closeModal );

				$formSubmitModal.addClass( '-open' );
				$formModalBackground.show();
			} else {
				//click submit button to trigger browser error functionality
				$formComponent.find( ':submit' ).click();
			}
		} );
	} );
} );
$( document ).ready( function () {
	var _activeElement;

	$( document ).find( '.component.faq' ).each( function () {
		var $this = $( this );
		$this.find( '.faq-card' ).on( 'click', function ( event ) {
			if ( _activeElement != this ) {
				setActive( this );
			} else {
				setNotActive( this );
			}
		} );

		$this.find( '.faq-card' ).on( 'mouseover', function ( event ) {
			if ( this != _activeElement ) {
				$this = $( this );
				$this.removeClass( 'theme-default' );
				$this.addClass( 'theme-rainforrest-white' );
				$this.find( '.faq-icon' ).addClass( '-active' );
			}
		} );

		$this.find( '.faq-card' ).on( 'mouseout', function ( event ) {
			if ( this != _activeElement ) {
				$this = $( this );
				if ( !$this.is( ':focus' ) ) {
					$this.addClass( 'theme-default' );
					$this.removeClass( 'theme-rainforrest-white' );
					$this.find( '.faq-icon' ).removeClass( '-active' );
				}
			}
		} );

		var setActive = function ( card ) {
			_activeElement = card;
			var $faqIcons = $( '.faq-icon' );
			var $card = $( card );
			$card.parent().children( '.faq-card' ).each( function () {
				var $this = $( this );
				$this.addClass( 'theme-default' );
				$this.removeClass( 'theme-rainforrest-white' );
				$this.find( '.faq-icon' ).removeClass( '-active' );
			} );
			$faqIcons.removeClass( '-active theme-rainforrest-white' );
			$( '.faq-card' ).addClass( 'theme-default -mobile-hidden' );
			$( '.faq-item' ).addClass( '-hidden' );
			var list = '.' + $card.data( 'faq-item' );
			$( list ).removeClass( '-hidden' );
			$card.addClass( 'theme-rainforrest-white' );
			$card.removeClass( '-mobile-hidden  theme-default' );
			$card.find( '.faq-icon' ).addClass( '-active' );
		};

		var setNotActive = function ( card ) {
			if ( card ) {
				var $card = $( card );
				$card.removeClass( 'theme-rainforrest-white' );
				$card.addClass( 'theme-default' );
				$card.find( '.faq-icon' ).removeClass( '-active' );
				$( '.' + $card.data( 'faq-item' ) ).addClass( '-hidden' );
				_activeElement = undefined;
				$( '.-mobile-hidden' ).removeClass( '-mobile-hidden' );
			}
		};
	} );
} );

$( document ).ready( function () {
	var $ctaButtonComponents = $( '.cta-button.component' );
	$ctaButtonComponents.each( function () {
		var $ctaButtonComponent = $( this );
		var $ctaButtonLink = $ctaButtonComponent.find( '.cta-button-link' );
		var ctaButtonId = $ctaButtonLink.data( 'id' );

		$ctaButtonLink.on( 'click', function ( e ) {
			// fire analytics event
			if(typeof utag !== 'undefined'){
				utag.link( {
					"tealium_event": "cta-click",
					"element_id": ctaButtonId
				} );
			}
		} );
	} );
} );

$( document ).ready( function () {
	$( '.article-carousel-container' ).each( function ( index ) {
		var $component = $( this );
		var $carouselWrapper = $component.find( '.article-carousel-wrapper' );
		var $nextButton = $component.find( '.-next' );
		var $prevButton = $component.find( '.-previous' );
		var $allDots = $component.find( '.dot' );
		var uniqueName = 'carousel' + index;
		var dotlist = $component.find( '.dot .dot-label ._visuallyhidden' );
		var titlelist = $component.find( '.article-card .title' );

		dotlist.each( function ( dotIndex ) {
			var currentDot = $( this );
			var titleElement = titlelist[ dotIndex ];
			var titleText = titleElement.innerHTML;
			var originalText = currentDot.html();
			var updatedText = originalText + ' ' + titleText;
			currentDot.html( updatedText );
		} );

		if ( !$carouselWrapper.hasClass( '-edit' ) ) {
			$carouselWrapper.slick( {
				centerMode: true,
				speed: 50,
				arrows: false,
				infinite: false,
				variableWidth: true
			} );

			// after slide change we want to select the correct radio button
			$carouselWrapper.on( 'afterChange', function () {
				var activeSlideIndex = $carouselWrapper.slick( 'slickCurrentSlide' );

				$component.find( '.dot input' ).removeAttr( 'checked' );
				$allDots.eq( activeSlideIndex ).find( 'input' ).attr( 'checked', 'checked' );

				$component.find( '.dot-img' ).removeClass( '-active' );
				$allDots.eq( activeSlideIndex ).find( '.dot-img' ).addClass( '-active' );

				$carouselWrapper.find( '.card-wrapper' ).eq( activeSlideIndex ).addClass( 'slick-active' );
			} );
			$nextButton.on( 'click', function () {
				$carouselWrapper.slick( 'slickNext' );
			} );
			$prevButton.on( 'click', function () {
				$carouselWrapper.slick( 'slickPrev' );
			} );
			$allDots.on( 'click', function () {
				var dotIndex = $allDots.index( $( this ) );
				$carouselWrapper.slick( 'slickGoTo', dotIndex );
			} );
			$carouselWrapper.find( '.card-wrapper' ).first().addClass( 'slick-active' ).attr( 'aria-hidden', 'false' );
			$allDots.first().find( 'input' ).click();

			//make sure the id's and names are unique
			$allDots.each( function () {
				var $thisDot = $( this );
				var $input = $thisDot.find( 'input' );
				var $label = $thisDot.find( 'label' );
				var newID = $input.attr( 'id' ).replace( 'carousel', uniqueName );
				$input.prop( 'id', newID );
				$input.attr( 'name', uniqueName );
				$label.prop( 'for', newID );
			} );
		}

	} );
} );

$( document ).ready( function () {
	$( 'body' ).on( 'click', '.alert-banner-item .alert-banner-item-close', function () {
		$( this ).parent().addClass( '_hidden' );
		$(this).closest('.alert-banner-item').removeClass('-top-margin');
	} );
} );
$( document ).ready( function () {
	var $accordionComponents = $( '.accordion-container' );
	$accordionComponents.each( function () {
		var $this = $( this );
		var $accordionTitle = $this.find( '.accordion-title' );

		$accordionTitle.on( 'click', function ( e ) {
			e.preventDefault();
			var $accordionContainer = $( this ).parent( '.accordion-container' );

			$this.find( '.accordion-text,.accordion-icon' ).toggleClass( '-expanded' );

			// set the correct aria-label for screen readers
			var _accordtionTitle = $this.find( '.accordion-title' );
			_accordtionTitle.children('.accordion-header').toggleClass( '-expanded' );
			var _ariaLabel = _accordtionTitle.attr( 'aria-expanded' );
			if ( _ariaLabel.indexOf( $arialLabel.collapsed ) < 0 ) {
				_ariaLabel = _ariaLabel.replace( $arialLabel.expanded, $arialLabel.collapsed );
			} else {
				_ariaLabel = _ariaLabel.replace( $arialLabel.collapsed, $arialLabel.expanded );
			}
			_accordtionTitle.attr( 'aria-expanded', _ariaLabel );
		} );
	} );
} );

$( document ).ready( function () {
	var $searchResultsComponent = $( 'body .search-results' );
	var $form = $searchResultsComponent.find( 'body .search-results-form' );
	var $searchInput = $( '.search-results-input' );
	var $searchPlaceholder = $( '.search-results-placeholder' );
	var $body = $( 'body' );

	var submitSearch = function ( e ) {
		e.preventDefault();

		$( 'body #searchInput' ).each( function () {
			var searchInputValue = $( this ).val();
			if ( searchInputValue != "" ) {
				$.ajax( {
					type: "GET",
					url: "/bin/search?term=" + searchInputValue,
					dataType: "json",
					success: function ( data ) {
						getSearchResults( data );
					},
					error: function ( data ) {
					}
				} );
			}
		} );
	}

	var getSearchResults = function ( data ) {
		if ( typeof ( data ) === 'object' ) {
			return appendResults( data );
		} else {
			return appendResults( JSON.parse( data ) );
		}
	}

	var appendResults = function ( data ) {
		$( 'body .search-results-items' ).empty();

		if ( data.length === 0) {
			var result = $( "<div class='search-results-item' tabindex='0'><div class='search-results-page-title'>No search results found</div></div>" );

			$( '.search-results-form-container, .search-results-description, .search-results-items, .search-results-logo, .search-results-icon-close-container' ).addClass( '-has-results' );
			$( '.search-results-items' ).append( result );

			var $firstItem = $( '.search-results-item').first();
			$firstItem.attr( 'aria-label', 'No search results found' ).focus();
			$firstItem.focus();
		} else {
			for ( var i = 0; i < data.length; i++ ) {
				var d = data[i];
				var path = d.pagePath;
				var title = d.title;
				var description = d.description;
				var result = $( [
					"<a href='" + decodeURI(encodeURI(path)) + ".html' class='search-results-item'>",
					"   <div class='search-results-page-title'>",
					"" + decodeURI(encodeURI(title)) + "",
					"   </div>",
					"   <p class='search-results-item-description'>",
					"" + decodeURI(encodeURI(description)) + "",
					"   </p>",
					"</a>"
				].join( "\n" ) );

				$( '.search-results-form-container, .search-results-description, .search-results-items, .search-results-logo, .search-results-icon-close-container' ).addClass( '-has-results' );
				$( '.search-results-items' ).append( result );
			}

			// Adds alert for when search results are ready, then moves focus to the first link after message is read
			var $firstItem = $( '.search-results-item').first();
			$( '.search-alert' ).attr( 'role', 'alert' );
			setTimeout( function (){
				$firstItem.focus();
			}, 2000);
		}
	}

	var clearResults = function () {
		$( '.search-results-form-container, .search-results-description, .search-results-items, .search-results-logo, .search-results-icon-close-container' ).removeClass( '-has-results' );
		$( '#searchInput' ).val( '' ).focus();
		$( '.search-results-items' ).empty();
	}

	$body.on( 'keypress', 'input', function ( e ) {
		if ( e.which == 13 ) {
			e.preventDefault();
			submitSearch( e );
		}
	} );

	$form.submit( function ( e ) {
		submitSearch( e );
	} );

	$body.on( 'click', '.search-results-icon-magnifying-glass', function ( e ) {
		submitSearch( e );
	} );

	$body.on( 'click', '.search-results-icon-close, .search-results-icon-close-container', function (e) {
		e.preventDefault();
		clearResults();
	} );

	$searchInput.on( 'focus', function () {
		$( this ).siblings( $searchPlaceholder ).addClass( '-to-top' );
	} );

	$searchInput.on( 'blur', function () {
		if ( $( this ).val().length === 0 ) {
			$( this ).siblings( $searchPlaceholder ).removeClass( '-to-top' );
		}
	} );

} );

$( document ).ready( function () {
	'use strict';

	var $whitelist = {};

	var $externalLinks = {
		getConfigurations: function () {
			$.ajax( {
				url: '/bin/mtb/config.whitelist.json',
				method: 'GET',
				async: false,
				success: function ( data ) {
					if ( data ) {
						if ( typeof ( data ) === 'object' ) {
							$whitelist = data.whitelist;
						} else {
							$whitelist = JSON.parse( data ).whitelist;
						}
					}
				},
				error: function ( jpXHR, status, error ) {
					console.error( 'Unable to obtain the speedbump whitelist: ' + error );
				}

			} );
		},

		setSpeedbumps: function () {
			$( document ).find( 'a' ).each( function () {
				var $anchor = $( this );
				var href = $anchor.attr( 'href' );

				if( href && ! href.startsWith('tel:') && ! href.startsWith('mailto:') && ! href.startsWith('javascript:') && ! href.startsWith( '/' ) && ! href.startsWith( '#') && ($anchor.data( 'speedbump') !== 'disabled') ){
					var speedbumpPage = $( '[data-speedbump-page]' );
					var speedbumpUrl = speedbumpPage.data( 'speedbump-page') + '?dest=' + href;
					$anchor.attr( 'href', speedbumpUrl );
				}
			} );
		},

		init: function () {
			this.setSpeedbumps();

			$( document ).trigger( 'speedbump:ready' );
		}
	}

	$externalLinks.init();
} );

