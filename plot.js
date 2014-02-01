
/**
 *
 */
var Plot = function(size, solid) {
  this.size = size;
  this.id = 'plot' + (++Plot.id);
  this.solid = solid || false;
  this.board_ = new Board(size);
  return this;
}
Plot.id = 0;

Plot.prototype.forEach_ = function(fn) {
  this.size.forEach(function(point) {
    if (this.get(point)) {
      fn.call(this, point);
    }
  }.bind(this));
};

Plot.prototype.canvas_ = function() {
  var canvas = document.createElement('canvas');
  this.size.apply(pxgame.const.GRID, canvas);
  return canvas;
};

/**
 * Draws noise, in the form of circles, onto the passed canvas.
 *
 * @param {Canvas} canvas to draw on
 * @param {number=} count of circles
 */
Plot.prototype.noise_ = function(canvas, count) {
  var ctx = canvas.getContext('2d');
  count = count || 32;

  this.forEach_(function(point) {
    // draw some noise!
    ctx.save();
    ctx.translate((pxgame.const.GRID * point.x) + (point.y * (pxgame.const.GRID / 2)), pxgame.const.GRID * point.y);
    var radius = pxgame.const.GRID / 2;
    ctx.translate(radius, radius);

    // draw n random circles nearby?
    for (var j = 0; j < count; ++j) {
      var x = Math.randInt(-radius, radius);
      var y = Math.randInt(-radius, radius);

      var weight = Math.random();
      var size = Math.pow(2, Math.random() * 4);

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, ' + weight + ')';
      ctx.translate(x, y);

      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI*2, true); 
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  });
  return canvas;
};

/**
 * Draws regular squares over the set points on the canvas.
 */
Plot.prototype.squares_ = function(canvas, fillStyle, strokeStyle, lineWidth) {
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = fillStyle || 'white';
  ctx.strokeStyle = fillStyle || 'white';
  ctx.lineWidth = lineWidth || 0.0;

  var halfgrid = (pxgame.const.GRID / 2);

  this.forEach_(function(point) {
    ctx.save();
    ctx.translate((pxgame.const.GRID * point.x) + (point.y * (pxgame.const.GRID / 2)), pxgame.const.GRID * point.y);

    var tleft = 1;
    var tright = 2;
    if (point.y % 2) {
      tleft = 5;
      tright = 4;
    }

    var bx = 0;
    var ex = 0;
    if (this.get(point.go(tleft))) {
      // left (up or down) is set
      bx -= halfgrid;
      ex += halfgrid;
    }
    if (this.get(point.go(tright))) {
      // right (up or down) is set
      ex += halfgrid;
    }

    // draw normal thing
    ctx.rect(bx, 0, pxgame.const.GRID + ex, pxgame.const.GRID);
    // ctx.stroke();
    ctx.fill();

    ctx.restore();
  });
};

/**
 * Draws lines between all set points onto the passed canvas. Lines are
 * described as a mapping between size and the RGBA color drawn (e.g.,
 * {32: "96, 0, 96, 0.2"}).
 *
 * @param {Canvas} canvas to draw on
 * @param {Object} lines to render
 * @param {number=} offset for line drawing, in pixels, vertically
 */
Plot.prototype.lines_ = function(canvas, lines, offset) {
  var ctx = canvas.getContext('2d');

  this.forEach_(function(point) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.translate(16, 16 + (offset || 0));

    for (var j = 0; j < 6; ++j) {
      var cand = point.go(j);
      if (!this.get(cand)) {
        continue;
      }
      var mX = (pxgame.const.GRID * cand.x) + (cand.y * (pxgame.const.GRID / 2));
      var mY = pxgame.const.GRID * cand.y;

      for (var i = 0; i < 6; ++i) {
        var cand2 = cand.go(i);
        if (cand2.equals(cand) || !this.get(cand2)) {
          continue;
        }

        ctx.beginPath();
        ctx.moveTo((pxgame.const.GRID * point.x) + (point.y * (pxgame.const.GRID / 2)), pxgame.const.GRID * point.y);
        ctx.quadraticCurveTo(mX, mY, (pxgame.const.GRID * cand2.x) + (cand2.y * (pxgame.const.GRID / 2)), pxgame.const.GRID * cand2.y);

        for (var width in lines) {
          ctx.lineWidth = width;
          ctx.strokeStyle = 'rgba(' + lines[width] + ')';
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  });

  return canvas;
};

Plot.prototype.blit_ = function(canvas, desc) {
  var ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'source-atop';

  if (desc.substring) {
    // string fillStyle, such as a color
    ctx.fillStyle = desc;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    // treat non-string as a patternable image
    var pattern = ctx.createPattern(desc, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
};

Plot.prototype.set = function(point, dimen) {
  dimen = dimen || 1;
  if (dimen <= 0) {
    return false;
  } else if (--dimen >= 1) {
    for (var j = 0; j < 6; ++j) {
      var cand = point.go(j);
      this.set(cand, dimen);
    }
  }
  return this.board_.access(point, true);
};

Plot.prototype.get = function(point) {
  return this.board_.access(point);
};

Plot.prototype.render = function() {
  Object.assert(false, "Plot.render must be implemented");
};

/**
 * WaterPlot renders water with a shorebank. It does not take any resource
 * to blit, and is by default solid.
 */
var WaterPlot = Object.subclass(Plot, function(world) {
  WaterPlot.super.call(this, world, true);
  return this;
});

WaterPlot.prototype.render = function() {
  var canvas = this.canvas_();
  this.lines_(canvas, {16: "0, 0, 0, 0.8"});
  this.blit_(canvas, '#006b9b');

  var mask = this.canvas_();
  this.lines_(mask, {32: "49, 128, 56, 0.75"}, 1);
  this.lines_(mask, {26: "0, 64, 0, 0.25"});
  this.lines_(mask, {26: "142, 106, 66, 0.25"}, 2);
  this.lines_(mask, {22: "43, 141, 196, 0.8"}, 4);

  var ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'darker';
  ctx.drawImage(mask, 0, 0);

  return canvas;
};

/**
 * DirtPlot renders something like a dirt path: using the passed res to create
 * areas that look 'rough around the edges'.
 */
var DirtPlot = Object.subclass(Plot, function(world, res) {
  DirtPlot.super.call(this, world, false);
  this.res_ = res;
  return this;
});

DirtPlot.prototype.render = function() {
  var canvas = this.canvas_();
  this.lines_(canvas, {12: "0, 0, 0, 0.8"});
  this.noise_(canvas);
  this.blit_(canvas, this.res_);
  return canvas;
};
