
/**
 *
 */
var Plot = function(world) {
  Object.assert(world instanceof pxgame.World, "Plot is based on world");
  this.w_ = world;  // store world for later
  this.width = world.width;
  this.height = world.height;
  this.id = 'plot' + (++Plot.id);
  this.plot_ = new Array(this.width * this.height);  // TODO: use bitarray
  return this;
}
Plot.id = 0;

Plot.prototype.canvas_ = function() {
  var canvas = document.createElement('canvas');
  canvas.width = ((this.width + 0.5) * pxgame.const.GRID);
  canvas.height = (this.height * pxgame.const.GRID);
  return canvas;
}

Plot.prototype.forEach_ = function(fn) {
  for (var jx = 0; jx < this.width; ++jx) {
    for (var y = 0; y < this.height; ++y) {
      var x = jx - Math.floor(y / 2);
      var point = Point.make(x, y);
      if (!this.get(point)) {
        continue;
      }
      fn.bind(this)(point);
    }
  }
};

Plot.prototype.noise_ = function(canvas) {
  var ctx = canvas.getContext('2d');
  this.forEach_(function(point) {
    // draw some noise!
    ctx.save();
    ctx.translate((pxgame.const.GRID * point.x) + (point.y * (pxgame.const.GRID / 2)), pxgame.const.GRID * point.y);
    var radius = pxgame.const.GRID / 2;
    ctx.translate(radius, radius);

    for (var j = 0; j < 96; ++j) {
      var x = Math.randInt(-radius, radius);
      var y = Math.randInt(-radius, radius);

      var weight = Math.random();
      var size = Math.pow(2, Math.random() * 4);

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, ' + weight + ')';
      ctx.translate(x, y);

      ctx.scale(Math.random() + 0.25, Math.random() + 0.25);

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
 * Draws lines between all set points onto the passed canvas. Lines are
 * described as a mapping between size and the RGBA color drawn (e.g.,
 * {32: "96, 0, 96, 0.2"}).
 *
 * @param {Canvas} canvas Canvas to draw on
 * @param {Object} lines Lines to render
 @ @param {number=} offset Vertical offset for line drawing, in pixels
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

  if (desc.substring) {  // check for string
    ctx.fillStyle = desc;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  Object.assert(desc.width == pxgame.const.GRID);
  Object.assert(desc.height == pxgame.const.GRID);

  for (var jx = -1; jx <= this.width; ++jx) {
    for (var y = 0; y < this.height; ++y) {
      var x = jx - Math.floor(y / 2);
      var point = Point.make(x, y);
      ctx.save();
      ctx.translate((pxgame.const.GRID * x) + (y * (pxgame.const.GRID / 2)), pxgame.const.GRID * y);
      ctx.drawImage(desc, 0, 0);
      ctx.restore();
    }
  }  
};

Plot.prototype.set = function(point, size) {
  size = size || 1;
  if (size <= 0) {
    return false;
  }
  var idx = this.w_.idx_(point);
  if (idx == -1) {
    return false;
  }
  if (this.plot_[idx]) {
    return true;  // already set
  }

  if (--size >= 1) {
    for (var j = 0; j < 6; ++j) {
      var cand = point.go(j);
      this.set(cand, size);
    }
  }
  this.plot_[idx] = true;
  return true;
};

Plot.prototype.get = function(point) {
  var idx = this.w_.idx_(point);
  if (idx == -1) {
    return true;
  }
  return this.plot_[idx];
};

Plot.prototype.render = function() {
  Object.assert(false, "Plot.render must be implemented");
};

var WaterPlot = Object.subclass(Plot, function(world) {
  WaterPlot.super.call(this, world);
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

var DirtPlot = Object.subclass(Plot, function(world, res) {
  DirtPlot.super.call(this, world);
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
