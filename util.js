
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
}

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
 * Each point represents an x,y tuple in a hex-based world.
 * See: http://keekerdc.com/2011/03/hexagon-grids-coordinate-systems-and-distance-calculations/
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
