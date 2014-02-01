
/**
 * Return a random integer [0,range) or [range,range_max).
 *
 * @return number
 */
Math.randInt = function(range, range_max) {
  var base = 0;
  if (range_max) {
    base = range;
    range = range_max - range;
  }
  return base + Math.floor(Math.random() * range);
};

/**
 * Returns the log2 of the passed number.
 */
Math.log2 = function(value) {
  return Math.log(value) / Math.log2.LN2;
};
Math.log2.LN2 = Math.log(2);

/**
 * Does this string start with the given prefix?
 *
 * @param {String} prefix Prefix to check
 * @return {boolean} Whether the string starts with it.
 */
String.prototype.startsWith = function(prefix) {
  return (this.substr(0, prefix.length) == prefix);
};

/**
 * Updates the child constructor to be a subclass of the parent. The child
 * constructor should still call the parent constructor if appropriate; this
 * may be done like; Child.super.call(this, ...)
 */
Object.subclass = function(parent, child) {
  child = child || function() {
    return parent.apply(this, arguments);
  };
  child.super = parent;
  child.prototype = Object.create(parent.prototype);
  child.prototype.constructor = parent;
  return child;
};

/**
 * Assert some condition, throwing Error if it does not hold.
 */
Object.assert = function(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
};

/**
 * Image loader helper.
 *
 * @param {String|Image} src Image name to load, or Image to instantiate
 * @return {Image} Unique image, ready to use.
 */
Image.load = function(src) {
  var img = new Image();
  img.src = (src instanceof Image ? src.src : src);
  return img;
};

/**
 * Size represents an immutable 2D-ish map containing hexes (each of Point). It
 * does not contain data itself, just providing helper methods to do with the
 * grid it describes.
 *
 * @constructor
 */
var Size = function(width, height) {
  Object.assert(width > 0, "Width must be >0");
  Object.assert(Math.floor(width) == width, "Width must be integer");
  Object.assert(height > 0, "Height must be >0");
  Object.assert(Math.floor(height) == height, "Width must be integer");
  this.width = width;
  this.height = height;
  this.length = width * height;
  return this;
};

/** Does this Size equal another Size? */
Size.prototype.equals = function(other) {
  return this == other || (this.width == other.width && this.height == other.height);
};

/**
 * Style a given HTMLElement or CSSStyleDeclaration to contain this Size.
 *
 * @param {number} grid size
 * @param {Object} object to style
 */
Size.prototype.apply = function(grid, object) {
  var width = ((this.width + 0.5) * grid);
  var height = (this.height * grid);

  if (object instanceof CSSStyleDeclaration) {
    object.width = width + 'px';
    object.height = height + 'px';
  } else {
    // probably a HTMLElement
    object.width = width;
    object.height = height;
  }
};

/**
 * Returns a random Point within this Size.
 *
 * @return {Point} random point
 */
Size.prototype.rand = function() {
  var y = Math.randInt(this.height);
  var x = Math.randInt(this.width) - Math.floor(y/2);
  return new Point(x, y);
};

/**
 * Provides the index within a buffer for a given Point.
 *
 * @return {number} index of Point, -1 for invalid
 */
Size.prototype.index = function(point) {
  if (point.y < 0 || point.y >= this.height) {
    return -1;
  }
  var y_2 = Math.floor(point.y/2);
  if (point.x < -y_2 || point.x >= this.width - y_2) {
    return -1;
  }
  return (point.y * this.width) + ((point.x + this.width) % this.width);
};

/**
 * Is the given Point valid inside this Size?
 *
 * @return {boolean} whether the Point is valid
 */
Size.prototype.valid = function(point) {
  return this.index(point) != -1;
};

/**
 * Calls the passed Function for each Point in this Size.
 *
 * @param {Function} fn to call
 */
Size.prototype.forEach = function(fn) {
  for (var jx = 0; jx < this.width; ++jx) {
    for (var y = 0; y < this.height; ++y) {
      var x = jx - Math.floor(y / 2);
      fn(new Point(x, y));
    }
  }
};

/**
 * Each Board represents generic storage for some Size.
 *
 * @constructor
 * @param {Size} size of board
 */
var Board = function(size) {
  this.size = size;

  var size = Math.ceil(size.length / Board.BITSIZE);
  this.bitset_ = new Board.BITSET(size);
  this.board_ = new Array(size.length);
};
Board.BITSET = Uint32Array;
Board.BITSIZE = Board.BITSET.BYTES_PER_ELEMENT * 8;
Board.BITSHIFT = Math.floor(Math.log2(Board.BITSIZE));

/**
 * Access some position on this Board (get/set).
 *
 */
Board.prototype.access = function(point, value) {
  var i = this.size.index(point);
  if (i == -1) {
    return true;
  }

  var bindex = (i >> Board.BITSHIFT);
  var boffset = 1 << (i % Board.BITSIZE);
  var curr = this.bitset_[bindex] & boffset;

  if (value === undefined) {
    // get only, return current bitset
    return !!curr;
  }

  var truthy = !!value;
  if (curr != truthy) {
    if (truthy) {
      // transition to true
      this.bitset_[bindex] |= boffset;
    } else {
      // transition to false (lazy way)
      this.bitset_[bindex] -= boffset;
    }
  }
  return truthy;
};

/**
 * Combines several boards, returning a new Board that contains just the bitset
 * (true/false) values only. Each board must be of the same Size.
 *
 * Accepts several arguments.
 */
Board.combine = function(board) {
  var out = new Board(board.size);
  for (var i = 0; i < arguments.length; ++i) {
    board = arguments[i];
    Object.assert(board.size.equals(out.size), "May only combine boards of equal size");
    for (var j = 0; j < out.bitset_.length; ++j) {
      out.bitset_[j] |= board.bitset_[j];
    }
  }
  return out;
};

/**
 * Each Point represents an immutable x,y tuple in a hex-based world.
 * See: http://keekerdc.com/2011/03/hexagon-grids-coordinate-systems-and-distance-calculations/
 *
 * @constructor
 * @param {number} x position
 * @param {number} y position
 */
var Point = function(x, y) {
  this.x = x;
  this.y = y;
  this.z = -(x+y);  // x+y+z=0, x+y=-z, z=-(x+y)
  return this;
};

/**
 * Convenience constructor for Point based on a screen (pixel) location and
 * grid size.
 *
 * @param {number} x Pixel x-position
 * @param {number} y Pixel y-position
 * @param {number} grid Grid size to use
 * @return {Point} new Point at this position
 */
Point.make = function(x, y, grid) {
  if (!grid) {
    // fallback behavior for idiots like me
    return new Point(x, y);
  }
  var px = Math.floor((x - y / 2) / grid);
  var py = Math.floor(y / grid);
  return new Point(px, py);
};

/** Stringify this Point. */
Point.prototype.toString = function() {
  return '' + this.x + ',' + this.y;
};

/** Does this Point equal another Point? */
Point.prototype.equals = function(other) {
  return this == other || (this.x == other.x && this.y == other.y);
};

/** Distance function between this Point and another Point. */
Point.prototype.metric = function(other) {
  if (this.equals(other)) {
    return 0;
  }
  return Math.max(Math.abs(this.x - other.x),
                  Math.abs(this.y - other.y),
                  Math.abs(this.z - other.z));
};

/**
 * Perform a DFS (or whatever) search from this point to another point. If no
 * path is found, then returns an empty Array.
 *
 * @param {Point} target Point to search for
 * @param {function(Point)=} callback Returns whether a point is available
 * @param {number=} steps Maximum number of steps to try
 * return {Array[Point]} points along path (not including this point)
 */
Point.prototype.search = function(target, callback, steps) {
  if (callback(target) == true) {
    // If the target is unavailable (hack: this looks for 'true', which matches
    // pxgame's Env only), then return immediately.
    return [];
  }

  var key = this.toString();
  var seen = {key: true};
  var queue = [{point: this}];

  steps = steps || 100;  // default 100 steps
  for (var i = 0; i < steps; ++i) {
    var next = queue.shift();
    if (!next) {
      break;  // no more points; rare but possible
    }

    // Check for success; the next point is the target.
    if (next.point.equals(target)) {
      var path = [];
      while (next && !next.point.equals(this)) {
        path.unshift(next.point);
        next = next.prev;
      }
      return path;
    }

    // Otherwise, walk in all directions from this point.
    next.point.forEach(function(p) {
      var key = p.toString();
      if (seen[key]) {
        return false;
      }
      seen[key] = true;

      // If this is the target, fall out immediately (and don't look at
      // farther points).
      if (target.equals(p)) {
        queue = [{prev: next, point: p}];
        return true;
      }

      // If the point is not valid, just skip out for now.
      if (callback(p)) {
        return false;
      }

      // Add this point and its metric in the right place.
      var metric = p.metric(target);
      var j = 0;
      while (j < queue.length && queue[j].metric < metric) { ++j; }
      queue.splice(j, 0, {prev: next, metric: metric, point: p});
    });
  }

  return [];
};

/**
 * Applies a function for each neighbour of this Point. If the fn returns 'true'
 * for any call, immediately returns.
 *
 * @param {function(Point)} fn Function to call for each neighbour
 */
Point.prototype.forEach = function(fn) {
  var m = Point.prototype.go.map_;
  for (var i = 0; i < 6; ++i) {
    var p = new Point(this.x + m.dx[i], this.y + m.dy[i]);
    var ret = fn(p);
    if (ret) {
      return true;
    }
  }
  return false;
};

/**
 * Returns the point in direction [0,6] from this Point.
 *
 * @param {number} d Direction to move
 * @return {Point} the Point in this direction
 */
Point.prototype.go = function(d) {
  if (d < 0 || d > 5) {
    throw new Error('point expected d in [0,6]');
  }
  var m = Point.prototype.go.map_;
  return new Point(this.x + m.dx[d], this.y + m.dy[d]);
};

/**
 * @private
 */
Point.prototype.go.map_ = {
  dx: [-1, +0, +1, +1, +0, -1],
  dy: [+0, -1, -1, +0, +1, +1]
};
