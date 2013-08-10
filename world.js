
/**
 * Some Env represents some environment on the world. It may be reused in
 * many placements (e.g., one tree Env re-used, one rock Env re-used).
 * It has properties |solid| and |large|.
 */
var Env = function(flags, type, random) {
  this.id = "env" + (++Ent.id);
  this.type_ = type;
  this.random_ = random;
  this.flags_ = flags;
  return this;
};
Env.SOLID = 1;
Env.LARGE = 2;
Env.id = 0;

Env.prototype.flag = function(flag) {
  return this.flags_ & flag;
}

Env.prototype.draw = function() {
  var t = document.createElement('li');
  t.classList.add(this.type_);
  if (this.random_) {
    t.classList.add(this.type_ + Math.randInt(this.random_));
  }
  return t;
};

/** Some Ent represents an object on the world. */
var Ent = function(img, clazz) {
  var t = document.createElement('li');
  clazz && t.classList.add(clazz);

  var timg = document.createElement('img');
  if (img instanceof Image) {
    timg.src = img.src;
  } else {
    timg.src = img;
  }
  t.appendChild(timg);

  t.style.display = 'none';
  this.el_ = t;
  this.img_ = timg;
  this.id = "ent" + (++Ent.id);
  return this;
};
Ent.id = 0;

/** Some Actor is an Ent which can move. */
var Actor = Object.subclass(Ent, function(img) {
  Actor.super.call(this, img, 'actor');
  return this;
});

/**
 * World creates a brand new world ("A whole new world")!
 * @constructor
 */
var World = function(holder, width, height) {
  width = Math.floor(width);
  height = Math.floor(height);
  var world = document.createElement('div');
  world.classList.add('world');
  world.style.width = ((width + 0.5) * World.GRID) + 'px';
  world.style.height = (height * World.GRID) + 'px';
  holder.appendChild(world);

  this.canvas_ = document.createElement('canvas');
  this.canvas_.width = ((width + 0.5) * World.GRID);
  this.canvas_.height = (height * World.GRID);
  world.appendChild(this.canvas_);

  this.describePlot_ = {};
  this.plot_ = new Array(width * height);

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

  var hover = document.createElement('li');
  hover.classList.add('hover');
  world.appendChild(hover);
  hover.style.display = 'none';

  world.addEventListener('mouseout', function(ev) {
    hover.style.display = 'none';
  });

  world.addEventListener('mousemove', function(ev) {
    var point = this.pointAt_(ev);
    if (this.isValidPoint(point)) {
      hover.style.display = '';
      this.placeAtPoint_(hover, point, 10);
    }
  }.bind(this));

  world.addEventListener('click', function(ev) {
    if (this.onClick) {
      this.onClick.bind(this)(this.pointAt_(ev));
    }
  }.bind(this));

  // Game "loop": enact moves around the map.
  setInterval(function() {
    for (var k in this.moving_) {
      var desc = this.moving_[k];
      var ret = this.performMoveStep_(desc.ent, desc.point, desc.move);
      if (ret != undefined) {
        var callback = desc.move.callback;
        delete this.moving_[k];
        delete desc.move;
          if (callback) {
          setTimeout(callback.bind(this, ret), 0);
        }
      }
    }
  }.bind(this), 1000 * World.FRAME);

  return this;
};

World.prototype.pointAt_ = function(ev) {
  var world = this.el_;
  var ty = Math.floor((ev.y - world.offsetTop) / World.GRID);
  var tx = Math.floor(((ev.x - ty*(World.GRID/2)) - world.offsetLeft) / World.GRID);
  return Point.make(tx, ty);
};

World.prototype.placeAtPoint_ = function(el, point, offset) {
  el.style.left = (World.GRID * point.x) + (point.y * (World.GRID / 2)) + 'px';
  el.style.top = (World.GRID * point.y) + 'px';
  el.style.display = '';
  el.style.zIndex = 1000 + (point.y + (offset*100 || 0));
};

/** Returns a list of points from (src,dst], or an empty array if not found. */
World.prototype.search_ = function(src, dst) {
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

World.prototype.performMoveStep_ = function(actor, now, move) {
  var targetIsEnt = (move.target instanceof Ent);
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

World.prototype.moveTo = function(actor, target, callback) {
  var desc = this.ents_[actor.id];
  Object.assert(desc, "Actor must be in world");

  // If the point actually contains an Ent, then use that as the target.
  if (target instanceof Point) {
    var at = this.at(target);
    if (at instanceof Ent) {
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

World.prototype.randPoint = function(allow_used) {
  allow_used = allow_used || false;

  for (;;) {
    var y = Math.randInt(this.height);
    var x = Math.randInt(this.width);
    x -= Math.floor(y/2);  // offset so the world is 'even'

    var p = Point.make(x, y);
    if (allow_used || !this.at(p)) {
      return p;
    }
  }
};

World.prototype.plot = function(plot, point) {
  Object.assert(this.isValidPoint(point), "must plot at valid point");
  var idx = this.idx_(point);

  this.plot_[idx] = plot;

  var fn = this.redraw_;
  if (!fn.timeout_) {
    fn.timeout_ = window.setTimeout(this.redraw_.bind(this), 0);
  }
};

World.prototype.describePlot = function(plot, canvas) {
  this.describePlot_[plot] = canvas;
};

/** Renders a bunch of lines onto the canvas where something is plotted there. */
World.prototype.renderMask_ = function(lines, canvas) {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = this.canvas_.width;
    canvas.height = this.canvas_.height;
  } else {
    Object.assert(canvas.width == this.canvas_.width);
    Object.assert(canvas.height == this.canvas_.height);
  }
  var ctx = canvas.getContext('2d');

  for (var jx = 0; jx < this.width; ++jx) {
    for (var y = 0; y < this.height; ++y) {
      var x = jx - Math.floor(y / 2);
      var point = Point.make(x, y);
      var idx = this.idx_(point);
      var value = this.plot_[idx];
      if (!value) {
        continue;
      }

      ctx.save();
      ctx.lineCap = 'round';
      ctx.translate(16, 16);

      for (var j = 0; j < 6; ++j) {
        var cand = point.go(j);
        if (!this.isValidPoint(cand)) {
          continue;
        }
        var v = this.plot_[this.idx_(cand)];
        if (v != value) {
          continue;
        }

        var mX = (World.GRID * cand.x) + (cand.y * (World.GRID / 2));
        var mY = World.GRID * cand.y;

        for (var i = 0; i < 6; ++i) {
          var cand2 = cand.go(i);
          if (cand2.equals(cand)) {
            continue;
          }

          // Pretend that invalid points are OK; extends masks outside bounds.
          if (this.isValidPoint(cand2)) {
            var v = this.plot_[this.idx_(cand2)];
            if (v != value) {
              continue;
            }
          }

          ctx.beginPath();
          ctx.moveTo((World.GRID * x) + (y * (World.GRID / 2)), World.GRID * y);
          ctx.quadraticCurveTo(mX, mY, (World.GRID * cand2.x) + (cand2.y * (World.GRID / 2)), World.GRID * cand2.y);

          for (var width in lines) {
            ctx.lineWidth = width;
            ctx.strokeStyle = 'rgba(' + lines[width] + ')';
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  }

  return canvas;
};

World.prototype.redraw_ = function() {
  this.redraw_.timeout_ = false;
  this.canvas_.width = this.canvas_.width;  // clear canvas

  // Draw a white (very solid) mask for the plot.
  var mask = this.renderMask_({28: "0, 0, 0, 0.8", 32: "0, 0, 0, 0.6"});
  var ctx = this.canvas_.getContext('2d');
  ctx.drawImage(mask, 0, 0);

  // Cover the world with plot "1".
  // TODO: more general definition of plot
  var desc = this.describePlot_[1];
  for (var jx = -1; jx <= this.width; ++jx) {
    for (var y = 0; y < this.height; ++y) {
      var x = jx - Math.floor(y / 2);
      var point = Point.make(x, y);
      ctx.save();
      ctx.translate((World.GRID * x) + (y * (World.GRID / 2)), World.GRID * y);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.drawImage(desc, 0, 0);
      ctx.restore();
    }
  }

  // Draw an outline for the plot.
  mask = this.renderMask_({32: "142, 106, 66, 0.25"});
  mask = this.renderMask_({28: "255, 255, 255, 0.8"}, mask);
  ctx.globalCompositeOperation = 'darker';
  ctx.drawImage(mask, 0, 0);
};

World.prototype.idx_ = function(point) {
  if (point.y < 0 || point.y >= this.height) {
    return -1;
  }
  var y_2 = Math.floor(point.y/2);
  if (point.x < -y_2 || point.x >= this.width - y_2) {
    return -1;
  }
  return (point.y * this.width) + ((point.x + this.width) % this.width);
};

World.prototype.isValidPoint = function(point) {
  return this.idx_(point) != -1;
};

/**
 * Returns the Ent at the given point, false for no object, or true for terrain
 * or out of bounds.
 */
World.prototype.at = function(point) {
  var idx = this.idx_(point);
  if (idx != -1) {
    return this.map_[idx];
  }
  return true;
};

World.prototype.addEnv = function(env, point) {
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
  Object.assert(env instanceof Env, "addEnv only works with Env");
  Object.assert(this.isValidPoint(point), "must addEnv at valid point");
  var idx = this.idx_(point);

  // Possibly draw this on a canvas, or retrieve an element (or both?).
  var el = env.draw();

  // If this is solid, then mark it on the actual map.
  if (env.flag(Env.SOLID)) {
    Object.assert(!this.map_[idx], "can't replace Ent from map");
    this.map_[idx] = true;
  }

  // Add the optional element to the map.
  var zoffset = 0;
  if (!env.flag(Env.LARGE)) {
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

World.prototype.place = function(e, point) {
  var prev = this.ents_[e.id];
  if (arguments.length == 1) {
    return prev.point;
  }
  Object.assert(e instanceof Ent, "place takes Ent only");
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

World.prototype.remove = function(e) {
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
  setTimeout(function(el) {
    el.opacity = 1;
    this.el_.removeChild(el);
  }.bind(this, e.el_), 100);

  e.world = null;
};

World.GRID = 32;
World.FRAME = 0.2;