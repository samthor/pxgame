'use strict';

/**
 * Return a random integer [0,range) or [range,range_max).
 *
 * @param {number} range to use
 * @param {number=} opt_max use values as a range
 * @return {number}
 */
Math.randInt = function(range, opt_max) {
  let base = 0;
  if (opt_max !== undefined) {
    base = range;
    range = opt_max - range;
  }
  return base + Math.floor(Math.random() * range);
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
 * @param {string|!Image} src Image name to load, or Image to instantiate
 * @return {!Image} Unique image, ready to use.
 */
Image.load = function(src) {
  let img = new Image();
  img.src = (src instanceof Image ? src.src : src);
  return img;
};

/**
 * Size represents an immutable 2D-ish map containing hexes (each of Point). It
 * does not contain data itself, just providing helper methods to do with the
 * grid it describes.
 */
class Size {
  /**
   * @param {number} width
   * @param {number} height
   */
  constructor(width, height) {
    Object.assert(width > 0, "Width must be >0");
    Object.assert(Math.floor(width) == width, "Width must be integer");
    Object.assert(height > 0, "Height must be >0");
    Object.assert(Math.floor(height) == height, "Width must be integer");
    this.width = width;
    this.height = height;
    this.length = width * height;
  }

  /**
   * @param {Size} other to compare to
   * @return {boolean} whether these points are equal
   */
  equals(other) {
    return !!other &&
        (this == other || (this.width == other.width && this.height == other.height));
  }

  /**
   * Style a given HTMLCanvasElement or CSSStyleDeclaration to contain this Size.
   *
   * @param {number} grid size
   * @param {CSSStyleDeclaration|HTMLCanvasElement} object to style
   */
  apply(grid, object) {
    let width = ((this.width + 0.5) * grid);
    let height = (this.height * grid);

    if (object instanceof CSSStyleDeclaration) {
      object.width = width + 'px';
      object.height = height + 'px';
    } else {
      // probably a HTMLCanvasElement
      object.width = width;
      object.height = height;
    }
  }

  /**
   * @return {Point} random point within this Size
   */
  rand() {
    let y = Math.randInt(this.height);
    let x = Math.randInt(this.width) - Math.floor(y/2);
    return new Point(x, y);
  }

  /**
   * Provides the index within a buffer for a given Point.
   *
   * @param {Point} point to analyize re: this Size
   * @return {number} index of Point, -1 for invalid
   */
  index(point) {
    if (!point || point.y < 0 || point.y >= this.height) {
      return -1;
    }
    let y_2 = Math.floor(point.y/2);
    if (point.x < -y_2 || point.x >= this.width - y_2) {
      return -1;
    }
    return (point.y * this.width) + ((point.x + this.width) % this.width);
  }

  /**
   * Is the given Point valid inside this Size?
   *
   * @param {Point} point to analyize re: this Size
   * @return {boolean} whether the Point is valid
   */
  valid(point) {
    return this.index(point) != -1;
  }

  /**
   * Calls the passed Function for each Point in this Size.
   *
   * @param {function(!Point)} fn to call
   * @param {*=} opt_this to use as this object
   */
  forEach(fn, opt_this) {
    for (let jx = 0; jx < this.width; ++jx) {
      for (let y = 0; y < this.height; ++y) {
        let x = jx - Math.floor(y / 2);
        fn.call(opt_this, new Point(x, y));
      }
    }
  }
}

/**
 * Each Board represents generic storage for some Size.
 */
class Board {
  /**
   * @param {Size} size of board
   */
  constructor(size) {
    this.size = size;

    let l = Math.ceil(size.length / Board.BITSIZE_);
    this.bitset_ = new Board.BITSET_(l);
    this.board_ = new Array(size.length);
  }

  /**
   * Access some position on this Board (get/set).
   *
   * @param {!Point} point to access
   * @param {*=} opt_value if not undefined, updates bitset
   * @return {boolean} bit status
   */
  access(point, opt_value) {
    let i = this.size.index(point);
    if (i == -1) {
      return true;
    }

    let bindex = (i >> Board.BITSHIFT_);
    let boffset = 1 << (i % Board.BITSIZE_);
    let curr = this.bitset_[bindex] & boffset;

    if (opt_value === undefined) {
      // get only, return current bitset
      return !!curr;
    }

    let truthy = !!opt_value;
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
  }

  /**
   * Combines several boards, returning a new Board that contains just the bitset
   * (true/false) values only. Each board must be of the same Size.
   *
   * @param {!Board} board
   * @param {...!Board} boards
   * @return {!Board}
   */
  static combine(board, ...boards) {
    let out = new Board(board.size);
    for (let i = 0; i < arguments.length; ++i) {
      let board = arguments[i];
      Object.assert(board.size.equals(out.size), "May only combine boards of equal size");
      for (let j = 0; j < out.bitset_.length; ++j) {
        out.bitset_[j] |= board.bitset_[j];
      }
    }
    return out;
  }
}

Board.BITSET_ = Uint32Array;
Board.BITSIZE_ = Board.BITSET_.BYTES_PER_ELEMENT * 8;
Board.BITSHIFT_ = Math.floor(Math.log2(Board.BITSIZE_));

/**
 * Each Point represents an immutable x,y tuple in a hex-based world.
 * See: http://keekerdc.com/2011/03/hexagon-grids-coordinate-systems-and-distance-calculations/
 */
class Point {
  /**
   * @param {number} x position
   * @param {number} y position
   */
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.z = -(x+y);  // x+y+z=0, x+y=-z, z=-(x+y)
  }

  /**
   * Convenience constructor for Point based on a screen (pixel) location and
   * grid size.
   *
   * @param {number} x Pixel x-position
   * @param {number} y Pixel y-position
   * @param {number} grid Grid size to use
   * @return {!Point} new Point at this position
   */
  static make(x, y, grid) {
    if (!grid) {
      // fallback behavior for idiots like me
      return new Point(x, y);
    }
    let px = Math.floor((x - y / 2) / grid);
    let py = Math.floor(y / grid);
    return new Point(px, py);
  }

  /**
   * @return {string} string version of this point
   */
  toString() {
    return '' + this.x + ',' + this.y;
  };

  /**
   * @param {Point} other to compare to
   * @return {boolean} whether these points are equal
   */
  equals(other) {
    return !!other
        && (this == other || (this.x == other.x && this.y == other.y));
  }

  /**
   * @param {!Point} other to compare to
   * @return {number} metric between these points
   */
  metric(other) {
    if (this.equals(other)) {
      return 0;
    }
    return Math.max(Math.abs(this.x - other.x),
                    Math.abs(this.y - other.y),
                    Math.abs(this.z - other.z));
  }

  /**
   * Perform a DFS from this point to find another point. If no path is found, then returns an
   * empty Array.
   *
   * @param {!Point} target Point to search for
   * @param {function(Point): boolean} callback Returns whether a point is available
   * @param {number=} opt_steps Maximum number of steps to try
   * return {!Array<!Point>} points along path (not including this point)
   */
  search(target, callback, opt_steps) {
    if (callback(target) == true) {
      // If the target is unavailable (hack: this looks for 'true', which matches
      // pxgame's Env only), then return immediately.
      return [];
    }

    let key = this.toString();
    let seen = {key: true};
    let queue = [{point: this}];

    let steps = opt_steps || 100;  // default 100 steps
    for (let i = 0; i < steps; ++i) {
      let next = queue.shift();
      if (!next) {
        break;  // no more points; rare but possible
      }

      // Check for success; the next point is the target.
      if (next.point.equals(target)) {
        let path = [];
        while (next && !next.point.equals(this)) {
          path.unshift(next.point);
          next = next.prev;
        }
        return path;
      }

      // Otherwise, walk in all directions from this point.
      next.point.forEach(function(p) {
        let key = p.toString();
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
        let metric = p.metric(target);
        let j = 0;
        while (j < queue.length && queue[j].metric < metric) { ++j; }
        queue.splice(j, 0, {prev: next, metric: metric, point: p});
      });
    }

    return [];
  }

  /**
   * Applies a function for each neighbour of this Point. If the fn returns a truthy value for
   * any neighbour, immediately returns.
   *
   * @param {function(!Point): boolean} fn Function to call for each neighbour
   * @return {boolean} whether this returned early
   */
  forEach(fn) {
    let m = Point.prototype.go.map_;
    for (let i = 0; i < 6; ++i) {
      let p = new Point(this.x + m.dx[i], this.y + m.dy[i]);
      let ret = fn(p);
      if (ret) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns the point in direction [0,6] from this Point. Throws an Error if outside this range.
   *
   * @param {number} d Direction to move
   * @return {!Point} the Point in this direction
   */
  go(d) {
    if (d < 0 || d > 5) {
      throw new Error('point expected d in [0,6]');
    }
    let m = Point.prototype.go.map_;
    return new Point(this.x + m.dx[d], this.y + m.dy[d]);
  }
}

/**
 * @private
 */
Point.prototype.go.map_ = {
  dx: [-1, +0, +1, +1, +0, -1],
  dy: [+0, -1, -1, +0, +1, +1],
};
