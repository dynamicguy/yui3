/**
 * Provides a plugin, which adds support for a scroll indicator to ScrollView instances
 *
 * @module scrollview-scrollbars
 */

var getClassName = Y.ClassNameManager.getClassName,
    _classNames,
    
    NATIVE_TRANSITIONS = Y.Transition.useNative,    
    SCROLLBAR = 'scrollbar',
    SCROLLVIEW = 'scrollview',

    VERTICAL_NODE = "verticalNode",
    HORIZONTAL_NODE = "horizontalNode",

    CHILD_CACHE = "childCache",

    TOP = "top",
    LEFT = "left",
    WIDTH = "width",
    HEIGHT = "height",
    SCROLL_WIDTH = "scrollWidth",
    SCROLL_HEIGHT = "scrollHeight",

    HORIZ_CACHE = "_sbh",
    VERT_CACHE = "_sbv",

    TRANSLATE_X = "translateX(",
    TRANSLATE_Y = "translateY(",
    SCALE_X = "scaleX(",
    SCALE_Y = "scaleY(",

    CLOSE = ")",
    PX_CLOSE = "px" + CLOSE;

/**
 * ScrollView plugin that adds scroll indicators to ScrollView instances
 *
 * @class ScrollViewScrollbars
 * @namespace Plugin
 * @extends Plugin.Base
 * @constructor
 */
function ScrollbarsPlugin() {
    ScrollbarsPlugin.superclass.constructor.apply(this, arguments);
}

ScrollbarsPlugin.CLASS_NAMES = {
    showing: getClassName(SCROLLVIEW, SCROLLBAR, 'showing'),
    scrollbar: getClassName(SCROLLVIEW, SCROLLBAR),
    scrollbarV: getClassName(SCROLLVIEW, SCROLLBAR, 'vert'),
    scrollbarH: getClassName(SCROLLVIEW, SCROLLBAR, 'horiz'),
    scrollbarVB: getClassName(SCROLLVIEW, SCROLLBAR, 'vert', 'basic'),
    scrollbarHB: getClassName(SCROLLVIEW, SCROLLBAR, 'horiz', 'basic'),
    child: getClassName(SCROLLVIEW, 'child'),
    first: getClassName(SCROLLVIEW, 'first'),
    middle: getClassName(SCROLLVIEW, 'middle'),
    last: getClassName(SCROLLVIEW, 'last')
};

_classNames = ScrollbarsPlugin.CLASS_NAMES;

/**
 * The identity of the plugin
 *
 * @property ScrollViewScrollbars.NAME
 * @type String
 * @default 'scrollbars-plugin'
 * @static
 */
ScrollbarsPlugin.NAME = 'pluginScrollViewScrollbars';
    
/**
 * The namespace on which the plugin will reside.
 *
 * @property ScrollViewScrollbars.NS
 * @type String
 * @default 'scrollbars'
 * @static
 */
ScrollbarsPlugin.NS = 'scrollbars';

/**
 * HTML template for the scrollbar
 *
 * @property ScrollViewScrollbars.SCROLLBAR_TEMPLATE
 * @type Object
 * @static
 */
ScrollbarsPlugin.SCROLLBAR_TEMPLATE = [
    '<div>',
    '<span class="' + _classNames.child + ' ' + _classNames.first + '"></span>',
    '<span class="' + _classNames.child + ' ' + _classNames.middle + '"></span>',
    '<span class="' + _classNames.child + ' ' + _classNames.last + '"></span>',
    '</div>'
].join('');

/**
 * The default attribute configuration for the plugin
 *
 * @property ScrollViewScrollbars.ATTRS
 * @type Object
 * @static
 */
ScrollbarsPlugin.ATTRS = {
    
    /**
     * Vertical scrollbar node
     *
     * @attribute verticalNode
     * @type Y.Node
     */
    verticalNode: {
		setter: '_setNode',
        value: Y.Node.create(ScrollbarsPlugin.SCROLLBAR_TEMPLATE)
    },

    /**
     * Horizontal scrollbar node
     *
     * @attribute horizontalNode
     * @type Y.Node
     */
    horizontalNode: {
		setter: '_setNode',
        value: Y.Node.create(ScrollbarsPlugin.SCROLLBAR_TEMPLATE)
    }
};

Y.namespace("Plugin").ScrollViewScrollbars = Y.extend(ScrollbarsPlugin, Y.Plugin.Base, {

    /**
     * Designated initializer
     *
     * @method initializer
     */    
    initializer: function() {
        this._host = this.get("host");

        this.afterHostMethod('_uiScrollY', this._update);
        this.afterHostMethod('_uiScrollX', this._update);
        this.afterHostMethod('_uiDimensionsChange', this._hostDimensionsChange);
        this.afterHostEvent('scrollEnd', this.flash);
    },

    /**
     * Set up the DOM nodes for the scrollbars. This method is invoked whenever the
     * host's _uiDimensionsChange fires, giving us the opportunity to remove un-needed
     * scrollbars, as well as add one if necessary.
     *
     * @method _hostDimensionsChange
     * @protected
     */    
    _hostDimensionsChange: function() {
        var host = this._host;

        this._renderBar(this.get(VERTICAL_NODE), host._scrollsVertical);
        this._renderBar(this.get(HORIZONTAL_NODE), host._scrollsHorizontal);

        this._update();

        Y.later(500, this, 'flash', true);
    },

    /**
     * Adds or removes a scrollbar node from the document.
     * 
     * @method _renderBar
     * @private
     * @param {Node} bar The scrollbar node
     * @param {boolean} add true, to add the node, false to remove it
     */
    _renderBar: function(bar, add) {
        var inDoc = bar.inDoc(),
            bb = this._host._bb,
            className = bar.getData("isHoriz") ? _classNames.scrollbarHB : _classNames.scrollbarVB;

        if (add && !inDoc) {
            bb.append(bar);
            bar.toggleClass(className, this._basic);
            this._setChildCache(bar);
        } else if(!add && inDoc) {
            bar.remove();
            this._clearChildCache(bar);
        }
    },

    /**
     * Caches scrollbar child element information,
     * to optimize _update implementation 
     * 
     * @method _setChildCache
     * @private
     * @param {Node} node
     */
    _setChildCache : function(node) {

        var c = node.get("children"),
            fc = c.item(0),
            mc = c.item(1),
            lc = c.item(2),
            size = node.getData("isHoriz") ? "offsetWidth" : "offsetHeight";

        node.setData(CHILD_CACHE, {
            fc : fc,
            lc : lc,
            mc : mc,
            fcSize : fc && fc.get(size),
            lcSize : lc && lc.get(size)
        });
    },

    /**
     * Clears child cache
     * 
     * @method _clearChildCache
     * @private
     * @param {Node} node
     */
    _clearChildCache : function(node) {
        node.clearData(CHILD_CACHE);
    },

    /**
     * Utility method, to move/resize either vertical or horizontal scrollbars
     *
     * @method _updateBar
     * @private
     *
     * @param {Node} scrollbar The scrollbar node.
     * @param {Number} current The current scroll position.
     * @param {Number} duration The transition duration.
     * @param {boolean} horiz true if horizontal, false if vertical.
     */
    _updateBar : function(scrollbar, current, duration, horiz) {

        var host = this._host,
            basic = this._basic,
            cb = host._cb,

            scrollbarSize = 0,
            scrollbarPos = 1,

            childCache = scrollbar.getData(CHILD_CACHE),
            lastChild = childCache.lc,
            middleChild = childCache.mc,
            firstChildSize = childCache.fcSize,
            lastChildSize = childCache.lcSize,
            middleChildSize,
            lastChildPosition,

            transition,
            translate,
            scale,

            dim,
            dimOffset,
            dimCache,
            widgetSize,
            contentSize;     

        if (horiz) {
            dim = WIDTH;
            dimOffset = LEFT;
            dimCache = HORIZ_CACHE;
            widgetSize = host.get(dim);
            contentSize = host._scrollWidth || cb.get(SCROLL_WIDTH);
            translate = TRANSLATE_X;
            scale = SCALE_X;
        } else {
            dim = HEIGHT;
            dimOffset = TOP;
            dimCache = VERT_CACHE;
            widgetSize = host.get(dim);
            contentSize = host._scrollHeight || cb.get(SCROLL_HEIGHT);
            translate = TRANSLATE_Y;
            scale = SCALE_Y;
        }

        scrollbarSize = Math.floor(widgetSize * (widgetSize/contentSize));
        scrollbarPos = Math.floor((current/(contentSize - widgetSize)) * (widgetSize - scrollbarSize));

        if (scrollbarSize > widgetSize) {
            scrollbarSize = 1;
        }

        if (scrollbarPos > (widgetSize - scrollbarSize)) {
            scrollbarSize = scrollbarSize - (scrollbarPos - (widgetSize - scrollbarSize));
        } else if (scrollbarPos < 0) {
            scrollbarSize = scrollbarPos + scrollbarSize;
            scrollbarPos = 0;
        }

        middleChildSize = (scrollbarSize - (firstChildSize + lastChildSize));

        if (middleChildSize < 0) {
            middleChildSize = 0;
        }

        if (middleChildSize === 0 && scrollbarPos !== 0) {
            scrollbarPos = widgetSize - (firstChildSize + lastChildSize) - 1;
        }

        // Position Scrollbar
        transition = {
            duration : duration
        };

        if (NATIVE_TRANSITIONS) {
            transition.transform = translate + scrollbarPos + PX_CLOSE;
        } else {
            transition[dimOffset] = scrollbarPos;
        }

        scrollbar.transition(transition);

        // Resize Scrollbar Middle Child
        if (this[dimCache] !== middleChildSize) {
            this[dimCache] = middleChildSize;

            if (middleChildSize > 0) {

                transition = {
                    duration : duration             
                };
    
                if(NATIVE_TRANSITIONS) {
                    transition.transform = scale + middleChildSize + CLOSE;
                } else {
                    transition[dim] = middleChildSize;
                }
    
                middleChild.transition(transition);
    
                // Position Last Child
                if (!horiz || !basic) {
    
                    transition = {
                        duration : duration
                    };
            
                    lastChildPosition = scrollbarSize - lastChildSize;
            
                    if (NATIVE_TRANSITIONS) {
                        transition.transform = translate + lastChildPosition + PX_CLOSE; 
                    } else {
                        transition[dimOffset] = lastChildPosition; 
                    }
        
                    lastChild.transition(transition);
                }
            }
        }
    },

    /**
     * Position and resize the scroll bars according to the content size
     *
     * @method _update
     * @param currentPos {Number} The current scrollX or scrollY value (not used here, but passed by default from _uiScrollX/_uiScrollY)
     * @param duration {Number} Number of ms of animation (optional) - used when snapping to bounds
     * @param easing {String} Optional easing equation to use during the animation, if duration is set
     * @protected
     */
    _update: function(currentPos, duration, easing) {
        
        var vNode = this.get(VERTICAL_NODE),
            hNode = this.get(HORIZONTAL_NODE),
            host = this._host;

        duration = (duration || 0)/1000;

        if (!this._showing) {
            this.show();
        }

        if (host._scrollsVertical && vNode) {
            this._updateBar(vNode, currentPos, duration, false);
        }

        if (host._scrollsHorizontal && hNode) {
            this._updateBar(hNode, currentPos, duration, true);
        }
    },

    /**
     * Show the scroll bar indicators
     *
     * @method show
     * @param animated {Boolean} Whether or not to animate the showing 
     */
    show: function(animated) {
        this._show(true, animated);
    },

    /**
     * Hide the scroll bar indicators
     *
     * @method hide
     * @param animated {Boolean} Whether or not to animate the hiding
     */
    hide: function(animated) {
        this._show(false, animated);
    },

    /**
     * Internal hide/show implementation utility method
     * 
     * @method _show
     * @param {Object} show
     * @param {Object} animated
     * @protected
     */
    _show : function(show, animated) {

        var verticalNode = this.get(VERTICAL_NODE),
            horizontalNode = this.get(HORIZONTAL_NODE),

            transition = {
                duration : (animated) ? 0.6 : 0,
                opacity : (show) ? 1 : 0
            };

        this._showing = show;

        if (this._flashTimer) {
            this._flashTimer.cancel();
        }

        if (verticalNode) {
            verticalNode.transition(transition);
        }

        if (horizontalNode) {
            horizontalNode.transition(transition);
        }
    },

    /**
     * Momentarily flash the scroll bars to indicate current scroll position
     *
     * @method flash
     */
    flash: function() {
        var shouldFlash = false,
            host = this._host;

        if (host._scrollsVertical && (host._scrollHeight > host.get(HEIGHT))) {
            shouldFlash = true;
        }

        if (host._scrollsHorizontal && (host._scrollWidth > host.get(WIDTH))) {
            shouldFlash = true;
        }

        if (shouldFlash) {
            this.show(true);
            this._flashTimer = Y.later(800, this, 'hide', true);
        }
    },

    /**
     * Setter for the verticalNode and horizontalNode attributes
     *
     * @method _setNode
     * @param node {Node} The Y.Node instance for the scrollbar
     * @param name {String} The attribute name
     * @return {Node} The Y.Node instance for the scrollbar
     * 
     * @protected
     */
    _setNode: function(node, name) {
        var horiz = (name == HORIZONTAL_NODE);

        node = Y.one(node);

        if (node) {
            node.addClass(_classNames.scrollbar);
            node.addClass( (horiz) ? _classNames.scrollbarH : _classNames.scrollbarV );
            node.setData("isHoriz", horiz);
        }

        return node;
    },

    _basic: Y.UA.ie && Y.UA.ie <= 8

});