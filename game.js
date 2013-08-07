
var CupEnt = Object.subclass(Ent, function() {
  CupEnt.super.call(this, 'res/cup.png');
  return this;
});

var InvEnt = Object.subclass(Ent, function(icon, title) {
  this.icon = icon;
  this.title = title;
  InvEnt.super.call(this, 'res/icons/' + icon + '.png', 'item');
  return this;
});

var PartEnv = Object.subclass(Env, function(flags, icon, index) {
  PartEnv.super.call(this, flags | Env.PART);
  if (!(icon instanceof Image)) {
    icon = document.getElementById(icon);
  }

  // Find the x/y origin of |index| within |icon|.
  index = index || 0;
  var rows = icon.width / World.GRID | 0;
  var sx = index % rows;
  var sy = index / rows | 0;

  // Draw the icon into |canvas|.
  this.canvas_ = document.createElement('canvas');
  this.canvas_.width = this.canvas_.height = World.GRID;
  var ctx = this.canvas_.getContext('2d');
  var z = World.GRID;
  ctx.drawImage(icon, sx * z, sy * z, z, z, 0, 0, z, z);

  return this;
});

PartEnv.prototype.draw = function() {
  // cloneNode() doesn't copy content; re-blit the dummy canvas.
  var canvas = this.canvas_.cloneNode();
  var ctx = canvas.getContext('2d');
  ctx.drawImage(this.canvas_, 0, 0);
  var li = document.createElement('li');
  li.appendChild(canvas);
  return li;
};

var buildWorld = function(width, height) {
  var ww = new World(document.body, width, height);

  // TODO: This is obviously a bit long.
  var env = {
    'grass': new Env(0, 'grass', 5),
    'rock': new Env(Env.SOLID, 'rock', 2),
    'wood': new Env(Env.SOLID, 'wood', 2),
    'tree': new Env(Env.SOLID | Env.LARGE, 'tree', 5),
    'water': new Env(Env.SOLID, 'water', 2),
    'fence-left': new PartEnv(Env.SOLID, 'res-fence', 0),
    'fence-mid': new PartEnv(Env.SOLID, 'res-fence', 1),
    'fence-right': new PartEnv(Env.SOLID, 'res-fence', 2),
    'fence-left-top': new PartEnv(Env.SOLID, 'res-fence', 6),
    'fence-right-top': new PartEnv(Env.SOLID, 'res-fence', 8),
    'fence-updown': new PartEnv(Env.SOLID, 'res-fence', 4),
    'fence-bottom': new PartEnv(Env.SOLID, 'res-fence', 3),
    'dirt-topleft': new PartEnv(0, 'res-dirt', 6),
    'dirt-top': new PartEnv(0, 'res-dirt', 7),
    'dirt-topright': new PartEnv(0, 'res-dirt', 8),
    'dirt-left': new PartEnv(0, 'res-dirt', 9),
    'dirt': new PartEnv(0, 'res-dirt', 10),
    'dirt-right': new PartEnv(0, 'res-dirt', 11),
    'dirt-downleft': new PartEnv(0, 'res-dirt', 12),
    'dirt-down': new PartEnv(0, 'res-dirt', 13),
    'dirt-downright': new PartEnv(0, 'res-dirt', 14),
    'dirt-invdownright': new PartEnv(0, 'res-dirt', 1),
  };
  var addEnv = function(id, count) {
    for (var i = 0; i < count; ++i) {
      ww.addEnv(env[id]);
    }
  };

  // Describe a fenced-off dirt area, and then draw it as a whole.
  var desc = [
    [
      env['fence-left-top'],
      env['fence-mid'],
      env['fence-mid'],
      env['fence-mid'],
      env['fence-mid'],
      env['fence-mid'],
      env['fence-right-top'],
    ],
    [
      env['fence-updown'],
      env['dirt-topleft'],
      env['dirt-top'],
      env['dirt-top'],
      env['dirt-top'],
      env['dirt-topright'],
      env['fence-updown'],
    ],
    [
      env['fence-updown'],
      env['dirt-left'],
      env['dirt'],
      env['dirt'],
      env['dirt-invdownright'],
      env['dirt-downright'],
      env['fence-bottom'],
    ],
    [
      env['fence-bottom'],
      env['dirt-left'],
      env['dirt'],
      env['dirt'],
      env['dirt-right'],
    ],
    [
      null,
      env['dirt-downleft'],
      env['dirt-down'],
      env['dirt-down'],
      env['dirt-downright'],
    ],
  ];
  var bx = Math.randInt(18);
  var by = Math.randInt(10);
  for (var y = 0; y < desc.length; ++y) {
    var row = desc[y];
    var off = by % 2;
    for (var x = 0; x < row.length; ++x) {
      var e = row[x];
      var p = Point.make(bx + x - Math.floor((y-off) / 2), by + y);
      e && ww.addEnv(e, p);
    }
  }

  addEnv('grass', 50);
  addEnv('rock', 20);
  addEnv('wood', 5);
  addEnv('tree', 15);
  addEnv('water', 20);

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

  var img = document.createElement('img');
  img.inv_src_ = inv;
  img.classList.add('item');
  img.src = 'res/icons/' + inv.icon + '.png';
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
      var naked = new Actor('res/naked0.png');
      world.place(naked, world.randPoint());

      var move = function() {
        world.moveTo(naked, world.randPoint());
        setTimeout(move, Math.randInt(4, 12) * 1000);
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

  var player = new Actor('res/princess0.png');
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
