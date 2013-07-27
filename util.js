
/**
 * Return a random integer [0,range) or [range,range_max).
 * @return integer
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
 */
String.prototype.startsWith = function(prefix) {
  if (this.length >= prefix.length && this.substr(0, prefix.length) == prefix) {
    return true; 
  }
  return false;
};

/**
 * Updates the child constructor to be a subclass of the parent. The child
 * constructor should still call the parent constructor if appropriate; this
 * may be done like; Child.super.call(this, ...)
 */
Object.subclass = function(parent, child) {
  child.super = parent;
  child.prototype = Object.create(parent.prototype);
  child.prototype.constructor = parent;
  return child;
};

/**
 * Assert some condition.
 */
Object.assert = function(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
}

/** Image loader helper. */
Image.load = function(src) {
  var img = new Image();
  img.src = src;
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

/** Convenience constructor for Point. */
Point.make = function(x, y) {
  return new Point(x, y);
};

Point.prototype.equals = function(other) {
  return this.x == other.x && this.y == other.y;
};

Point.prototype.toString = function() {
  return '' + this.x + ',' + this.y;
};

/** Distance function between this Point and anther Point. */
Point.prototype.metric = function(other) {
  return Math.max(Math.abs(this.x - other.x),
                  Math.abs(this.y - other.y),
                  Math.abs(this.z - other.z));
};

Point.prototype.go = function(d) {
  if (d < 0 || d > 5) {
    throw new Error('point expected d in [0,6]');
  }
  var m = Point.prototype.go.map;
  return Point.make(this.x + m.dx[d], this.y + m.dy[d]);
};
Point.prototype.go.map = {
  dx: [-1, +0, +1, +1, +0, -1],
  dy: [+0, -1, -1, +0, +1, +1]
};
