chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('game.html', {
    'frame': 'none',
    'bounds': {
      'width': 400,
      'height': 500
    }
  });
});