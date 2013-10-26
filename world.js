
// Namespace
var pxgame = {const:{GRID: 32, FRAME: 0.2}};

/**
 * Some Env represents some single type of environmental object on the world.
 * It may be reused in many placements (e.g., a tree or a rock). It has flags
 * SOLID (whether instances of Ent can be 'on top') and LARGE (whether it is
 * bigger than a single hex alone).
 *
 * Typically this should not be subclassed.
 *
 * @constructor
 * @param {number} flags Flags to set, e.g., SOLID and LARGE
 * @param {String} type CSS class to use/set on the later generated HTML
 * @param {random=} random Random range in [0,random] to apply as part of
 *    the added CSS class
 */
pxgame.Env = function(flags, type, random) {
  this.id = "env" + (++pxgame.Ent.id_);
  this.type_ = type;
  this.random_ = random;
  this.flags_ = flags;
  return this;
};
pxgame.Env.id_ = 0;
pxgame.Env.SOLID = 1;
pxgame.Env.LARGE = 2;

/**
 * Does this Env have the given flag set?
 *
 * @param {number} flag Flag to check for
 * @return {boolean} Whether the flag is set
 */
pxgame.Env.prototype.flag = function(flag) {
  return this.flags_ & flag;
}

/**
 * Draws this Env into its HTML equivalent (a <li>). This may be called many
 * times.
 *
 * @return {Element} the HTML rendering of a single Env
 */
pxgame.Env.prototype.draw = function() {
  var t = document.createElement('li');
  t.classList.add(this.type_);
  if (this.random_) {
    t.classList.add(this.type_ + Math.randInt(this.random_));
  }
  return t;
};

/**
 * Some Ent represents an object on the world. Each instantiation is a unique
 * object that might be interacted with.
 *
 * Ent should typically be subclassed, and is subclassed for free in Actor.
 *
 * @constructor
 * @param {String|Image} img Image to use as the Ent's image.
 * @param {String=} clazz Class name to add to the Ent
 */
pxgame.Ent = function(img, clazz) {
  var t = document.createElement('li');
  clazz && t.classList.add(clazz);

  this.img_ = Image.load(img);
  t.appendChild(this.img_);

  t.style.display = 'none';
  this.el_ = t;
  this.id = "ent" + (++pxgame.Ent.id_);
  return this;
};
pxgame.Ent.id_ = 0;

/** Some Actor is an Ent which can move. */
pxgame.Actor = Object.subclass(pxgame.Ent, function(img) {
  pxgame.Actor.super.call(this, img, 'actor');
  return this;
});

/**
 * World creates a brand new world ("A whole new world")!
 *
 * @constructor
 */
pxgame.World = function(holder, width, height) {
  width = Math.floor(width);
  height = Math.floor(height);
  var world = document.createElement('div');
  world.classList.add('world');
  world.style.width = ((width + 0.5) * pxgame.const.GRID) + 'px';
  world.style.height = (height * pxgame.const.GRID) + 'px';
  holder.appendChild(world);

  // Grid, for debugging tiles.
  var grid = document.createElement('div');
  grid.classList.add('grid');
  // world.appendChild(grid);

  this.width = width;
  this.height = height;
  this.el_ = world;
  this.map_ = new Array(width * height);
  this.envmap_ = new Array(width * height);
  this.ents_ = {};
  this.moving_ = {};

  // Highlight the currently focused hex, and manage mouse events.
  (function() {
    var pointAt = function(ev) {
      var x = ev.x - world.offsetLeft;
      var y = ev.y - world.offsetTop;
      return Point.atPos(x, y, pxgame.const.GRID);
    };

    var hover = document.createElement('li');
    hover.classList.add('hover');
    world.appendChild(hover);
    hover.style.display = 'none';

    world.addEventListener('mouseout', function(ev) {
      hover.style.display = 'none';
    });

    world.addEventListener('mousemove', function(ev) {
      var point = pointAt(ev);
      if (this.isValidPoint(point)) {
        hover.style.display = '';
        this.placeAtPoint_(hover, point, 10);
      }
    }.bind(this));

    world.addEventListener('click', function(ev) {
      // Pass tap/click back to the user.
      this.onClick && this.onClick.call(this, pointAt(ev));
    }.bind(this));
  }.apply(this));

  // Game "loop": enact moves around the map.
  window.setInterval(function() {
    for (var k in this.moving_) {
      var desc = this.moving_[k];
      var ret = this.performMoveStep_(desc.ent, desc.point, desc.move);
      if (ret != undefined) {
        var callback = desc.move.callback;
        delete this.moving_[k];
        delete desc.move;
        if (callback) {
          window.setTimeout(callback.bind(this, ret), 0);
        }
      }
    }
  }.bind(this), 1000 * pxgame.const.FRAME);

  return this;
};

/**
 * Places the given Element in its rightful place within this World.
 *
 * @private
 * @param {Element} el Element to style
 * @param {Point} point Point to place at
 * @param {number=} offset zIndex offset to apply (if any)
 */
pxgame.World.prototype.placeAtPoint_ = function(el, point, offset) {
  var s = el.style;
  s.left = (pxgame.const.GRID * (point.x + point.y/2)) + 'px';
  s.top = (pxgame.const.GRID * point.y) + 'px';
  s.display = '';
  s.zIndex = 1000 + (point.y + (offset*100 || 0));
};

/** Returns a list of points from (src,dst], or an empty array if not found. */
pxgame.World.prototype.search_ = function(src, dst) {
  var opts = [];
  var seen = {};

  if (this.at(dst) === true) {
    console.debug('search_: can\'t find terrain or oob');
    return [];
  }

  var insert = function(now) {
    for (var i = 0; i < 6; ++i) {
      var p = now.point.go(i);
      var key = p.toString();
      if (seen[key]) {
        continue;
      }
      seen[key] = true;

      if (dst.equals(p) || !this.at(p)) {
        var metric = p.metric(dst);
        var j = 0;
        // TODO: Binary search for option insert.
        while (j < opts.length && opts[j].metric < metric) {
          ++j;
        }
        opts.splice(j, 0, {prev: now, metric: metric, point: p});
      }
    }
  }.bind(this);

  insert({point: src});
  var num = 0;
  while (num < 100 && opts.length > 0) {
    var next = opts.shift();
    num++;
    if (next.point.equals(dst)) {
      console.debug('search_: success with', num, 'steps');
      var path = [];
      while (!next.point.equals(src)) {
        path.unshift(next.point);
        next = next.prev;
      }
      return path;
    }
    insert(next);
  }
  console.debug('search_: failure with', num, 'steps');
  return [];
};

pxgame.World.prototype.performMoveStep_ = function(actor, now, move) {
  var targetIsEnt = (move.target instanceof pxgame.Ent);
  var target = (targetIsEnt ? this.place(move.target) : move.target);
  Object.assert(target, "performMoveStep_ only with target");

  if (now.equals(target)) {
    return true;  // success
  }

  // If the target is an ent, check whether it's moved.
  // TODO: Check whether it's just gone too.
  if (targetIsEnt && move.path) {
    var lastPoint = move.path[move.path.length - 1];
    if (!lastPoint.equals(target)) {
      console.debug('performMoveStep_: target moved');
      delete move.path;
    }
  }

  // If there's no path to the target, build it (using best-first).
  if (!move.path) {
    move.path = this.search_(now, target);
    if (!move.path.length) {
      console.debug('performMoveStep_: can\'t find target');
      return false;  // give up
    }
  }

  // Try to perform the step.
  var step = move.path.shift();
  Object.assert(step.metric(now) <= 1, "Actor can't step more than one tile");
  var at = this.at(step);
  if (at) {
    if (move.path.length == 0) {
      if (targetIsEnt && at == move.target) {
        console.debug('performMoveStep_: next to ent target, \'done\'');
        return move.target;  // 'success' by returning the ent
      }
    }

    console.debug('performMoveStep_: step was occupied, trying again');
    delete move.path;  // don't return anything, this will retry us
  } else {
    this.place(actor, step);
  }
};

pxgame.World.prototype.moveTo = function(actor, target, callback) {
  var desc = this.ents_[actor.id];
  Object.assert(desc, "Actor must be in world");

  // If the point actually contains an Ent, then use that as the target.
  if (target instanceof Point) {
    var at = this.at(target);
    if (at instanceof pxgame.Ent) {
      target = at;
    }
  }

  // If there was a previous move callback invoke it early.
  if (desc.move && desc.move.callback) {
    desc.move.callback();
  }

  // Configure the new move spec inside ent description.
  desc.move = {target: target, callback: callback};
  this.moving_[actor.id] = desc;
};

pxgame.World.prototype.randPoint = function(allow_used) {
  allow_used = allow_used || false;

  for (;;) {
    var y = Math.randInt(this.height);
    var x = Math.randInt(this.width) - Math.floor(y/2);
    var p = Point.make(x, y);
    if (allow_used || !this.at(p)) {
      return p;
    }
  }
};

pxgame.World.prototype.idx_ = function(point) {
  if (point.y < 0 || point.y >= this.height) {
    return -1;
  }
  var y_2 = Math.floor(point.y/2);
  if (point.x < -y_2 || point.x >= this.width - y_2) {
    return -1;
  }
  return (point.y * this.width) + ((point.x + this.width) % this.width);
};

pxgame.World.prototype.isValidPoint = function(point) {
  return this.idx_(point) != -1;
};

/**
 * Returns what is at the given Point. If there is a solid Env or this point
 * is out of bounds, returns true; otherwise, returns the Ent here or false
 * otherwise.
 *
 * @param {Point} at The position to check
 * @return {boolean|Ent} What is at this point
 */
pxgame.World.prototype.at = function(point) {
  var idx = this.idx_(point);
  if (idx != -1) {
    return this.map_[idx];
  }
  return true;
};

pxgame.World.prototype.addEnv = function(env, point) {
  if (arguments.length == 1) {
    // Find a free point that doesn't already have Env.
    for (;;) {
      point = this.randPoint();
      var idx = this.idx_(point);
      if (!this.envmap_[idx]) {
        break;
      }
    }
  }
  Object.assert(env instanceof pxgame.Env, "addEnv only works with Env");
  Object.assert(this.isValidPoint(point), "must addEnv at valid point");
  var idx = this.idx_(point);

  // Possibly draw this on a canvas, or retrieve an element (or both?).
  var el = env.draw();

  // If this is solid, then mark it on the actual map.
  if (env.flag(pxgame.Env.SOLID)) {
    Object.assert(!this.map_[idx], "can't replace Ent from map");
    this.map_[idx] = true;
  }

  // Add the optional element to the map.
  var zoffset = 0;
  if (!env.flag(pxgame.Env.LARGE)) {
    --zoffset;
  }
  this.el_.appendChild(el);
  this.placeAtPoint_(el, point, zoffset);

  // Place the drawn environment into |envmap_|, removing any environment
  // already there (i.e., non-solid environment).
  var prev = this.envmap_[idx];
  if (prev && prev !== true) {
    this.el_.removeChild(prev);
  }
  this.envmap_[idx] = el || true;
}

pxgame.World.prototype.place = function(e, point) {
  var prev = this.ents_[e.id];
  if (arguments.length == 1) {
    return prev.point;
  }
  Object.assert(e instanceof pxgame.Ent, "place takes Ent only");
  Object.assert(this.isValidPoint(point), "must place at valid point");

  // Add to this world if not already there.
  if (e.world != this) {
    Object.assert(!e.world, "can't steal Ent from another world");
    e.world = this;
    this.el_.appendChild(e.el_);
    this.ents_[e.id] = {ent: e};
  } else {
    // Delete this Ent from its previous location if there.
    delete this.map_[this.idx_(prev.point)];
  }

  // Remove anything already at this position (perhaps we should be less
  // aggressive about this).
  var idx = this.idx_(point);
  Object.assert(!this.map_[idx], "place can't overwrite another Ent");

  // Place this Ent on the world, both conceptually and 'physically'.
  this.ents_[e.id].point = point;
  this.map_[idx] = e;
  this.placeAtPoint_(e.el_, point);  // do css placement
};

pxgame.World.prototype.remove = function(e) {
  var desc = this.ents_[e.id];
  Object.assert(desc, "Actor must be in world");

  if (desc.move && desc.move.callback) {
    desc.move.callback();
  }
  var point = desc.point;
  var idx = this.idx_(point);
  delete this.ents_[e.id];
  delete this.map_[idx];

  e.el_.style.opacity = 0;
  window.setTimeout(function(el) {
    el.opacity = 1;
    this.el_.removeChild(el);
  }.bind(this, e.el_), 100);

  e.world = null;
};
