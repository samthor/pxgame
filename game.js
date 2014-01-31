
var CupEnt = Object.subclass(pxgame.Ent, function() {
  CupEnt.super.call(this, 'res/cup.png');
  return this;
});

var InvEnt = Object.subclass(pxgame.Ent, function(icon, title) {
  this.icon = icon;
  this.title = title;
  InvEnt.super.call(this, 'res/icons/' + icon + '.png', 'item');
  return this;
});

/** Builds a small (pxgame.const.GRID dimensioned) */
var canvasFromImageIndex = function(icon, index) {
  if (!(icon instanceof Image)) {
    icon = document.getElementById(icon);
  }

  // Find the x/y origin of |index| within |icon|.
  index = index || 0;
  var rows = icon.width / pxgame.const.GRID | 0;
  var sx = index % rows;
  var sy = index / rows | 0;

  // Draw the icon into |canvas|.
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = pxgame.const.GRID;
  var ctx = canvas.getContext('2d');
  var z = pxgame.const.GRID;
  ctx.drawImage(icon, sx * z, sy * z, z, z, 0, 0, z, z);
  return canvas;
};

var buildWorld = function(width, height) {
  var ww = new pxgame.World(document.body, width, height);

  var env = {
    'grass': new pxgame.Env('grass', 5),
    'rock': new pxgame.Env('rock', 2),
    'wood': new pxgame.Env('wood', 2),
    'tree': new pxgame.LargeEnv('tree', 5),
    'water': new pxgame.Env('water', 2),
  };
  var addEnv = function(id, count) {
    for (var i = 0; i < count; ++i) {
      ww.addEnv(env[id]);
    }
  };

  var dirt = new DirtPlot(ww, canvasFromImageIndex('res-dirt', 10));
  var p = ww.randPoint();
  for (var i = 0; i < 80; ++i) {
    var dir = Math.randInt(6);
    var distance = Math.randInt(1, 4);
    while (--distance) {
      var cand = p.go(dir);
      if (!dirt.set(cand)) {
        break;
      }
      p = cand;
    }
  }
  ww.addPlot(dirt);

  // Draw a semi-random path of plot (dirt for now).
  var water = new WaterPlot(ww);
  var p = ww.randPoint();
  for (var i = 0; i < 80; ++i) {
    var dir = Math.randInt(6);
    var distance = Math.randInt(1, 4);
    while (--distance) {
      var cand = p.go(dir);
      if (!water.set(cand)) {
        break;
      }
      p = cand;
    }
  }
  ww.addPlot(water);

  addEnv('rock', 20);
  addEnv('wood', 5);
  addEnv('tree', 15);

  // These two envs have solid backgrounds; they look bad over the plot.
  // addEnv('grass', 50);
  // addEnv('water', 20);

  return ww;
}

var InventoryManager = function(holder) {
  var feature = document.createElement('div');
  feature.classList.add('feature');
  holder.appendChild(feature);
  this.el_ = feature;
  this.items_ = {};
  return this;
};

/** Gains the InvEnt into this InventoryManager. */
InventoryManager.prototype.gain = function(inv) {
  Object.assert(inv instanceof InvEnt, "manager only takes InvEnt instances");
  this.items_[inv.id] = inv;

  var img = Image.load('res/icons/' + inv.icon + '.png');
  img.inv_src_ = inv;
  img.classList.add('item');
  img.title = inv.title;
  img.draggable = true;  // default, but just for sanity

  // Add the multitude of handlers required for drag/drop.
  img.addEventListener('dragstart', function(e) {
    img.classList.add('dragged');
    e.dataTransfer.effectAllowed = 'move';
    this.dragged_ = inv;
  }.bind(this), false);
  img.addEventListener('dragend', function() {
    img.classList.remove('dragged');
    delete this.dragged_;
  }, false);
  img.addEventListener('dragenter', function(e) {
    if (this.dragged_ && this.dragged_ != inv) {
      img.classList.add('target');
    }
  }.bind(this));
  img.addEventListener('dragleave', function(e) {
    img.classList.remove('target');
  });
  img.addEventListener('dragover', function(e) {
    e.preventDefault && e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  });
  img.addEventListener('drop', function(e) {
    img.classList.remove('target');
    if (this.dragged_) {
      var src = this.dragged_;
      delete this.dragged_;
      if (src != inv) {
        // Can't combine an item with itself.
        this.combine(src, inv);
      }
    }
  }.bind(this));

  this.el_.appendChild(img);
};

/** Combine itemA and itemB. */
InventoryManager.prototype.combine = function(itemA, itemB) {
  console.info("Combine", itemA.title, itemB.title);
};

window.addEventListener('load', function() {
  var world = buildWorld(28, 16);

  for (var i = 0; i < 2; i++) {
    var e = new CupEnt();
    world.place(e, world.randPoint());
  }

  // Create random naked people.
  for (var i = 0; i < 1; ++i) {
    (function() {
      var naked = new pxgame.Actor('res/naked0.png');
      world.place(naked, world.randPoint());

      var move = function() {
        world.moveTo(naked, world.randPoint());
        window.setTimeout(move, Math.randInt(4, 12) * 1000);
      };
      move();
    })();
  }

  var manager = new InventoryManager(document.body);
  var items = {
    'I_C_Apple': "It's an apple! Eat it or whatever.",
    'W_Axe014': "AXE COP",
    'I_Scroll': "I decree...",
    'I_C_Strawberry': "Hint: it's actually poison.",
    'Ac_Ring03': "I DO",
    'I_GoldCoin': "Lost to inflation.",
    'I_Key03': "It opens a ring to my heart <3",
    'I_Torch02': "Why can you carry this when it's on fire?",
    'P_Medicine05': "To turn yourself into a Smurf(TM).",
    'A_Clothing02': "Because that naked person does need some clothes.",
    'I_Coal': "Don't tell Bob Brown.",
    'I_GoldBar': "We're rich!",
    'I_Map': "Yarrrrrrr",
    'I_Opal': "We're.. not so rich.",
    'S_Thunder01': "Who left this thunder lying around?",
    'W_Book06': "Judge me by my cover!",
    'W_Throw05': "NINJAS",
  };
  for (var k in items) {
    var i = new InvEnt(k, items[k]);
    world.place(i, world.randPoint());
  }

  var i = new InvEnt('C_Hat02', "WIZARD");
  manager.gain(i);
  var i = new InvEnt('I_Bone', "Boner");
  manager.gain(i);

  var player = new pxgame.Actor('res/princess0.png');
  world.place(player, world.randPoint());
  world.onClick = function(point) {
    var playerAt = this.place(player);
    this.moveTo(player, point, function(result) {
      if (result instanceof InvEnt) {
        world.remove(result);
        manager.gain(result);
      }
    });
  };
});
