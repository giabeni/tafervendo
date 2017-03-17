var app = angular.module('tafervendo', ['ionic', 'ngCordova', 'ngSanitize', 'backand', 'ngCookies', 'ngOpenFB']);

app.run(function($ionicPlatform, ngFB) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);

    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }

    //admob
    if(window.plugins && window.plugins.AdMob) {
            var admob_key = device.platform == "Android" ? "ca-app-pub-1021577741280918/8714107987" : "ca-app-pub-1021577741280918/2807175181";
            var admob = window.plugins.AdMob;
            admob.createBannerView(
                {
                    'publisherId': admob_key,
                    'adSize': admob.AD_SIZE.BANNER,
                    'bannerAtTop': false
                },
                function() {
                //TODO change test to false
                    admob.requestAd(
                        { 'isTesting': false },
                        function() {
                            admob.showAd(true);
                        },
                        function() { console.log('failed to request ad'); }
                    );
                },
                function() { console.log('failed to create banner view'); }
            );
        }

    //initialize facebook
    ngFB.init({appId: '1442526929123214'});
  });
});

app.config(function($stateProvider, $urlRouterProvider, BackandProvider,$httpProvider) {
  //Backand Settings
  BackandProvider.setAppName('tafervendo');
  BackandProvider.setAnonymousToken('3560099e-ff06-497d-82bd-d98405dbb040');
  $httpProvider.interceptors.push(httpInterceptor);
  $httpProvider.defaults.useXDomain = true;

  function httpInterceptor($q, $log, $cookieStore) {
    return {
      request: function(config) {
        config.headers['Authorization'] =
          $cookieStore.get('backand_token');
        return config;
      }
    };
  }

  $stateProvider

    .state('app', {
    url: '/app',
    abstract: true,
    templateUrl: 'templates/menu.html',
    controller: 'AppCtrl'
  })

  .state('app.map', {
    url: '/map',
    views: {
      'menuContent': {
        templateUrl: 'templates/map.html',
        controller: 'MapCtrl'
      }
    }
  })

  .state('app.suggestions', {
      url: '/suggestions',
      views: {
        'menuContent': {
          templateUrl: 'templates/suggestions.html',
          controller: 'SuggestionsCtrl'
        }
      }
    })

    .state('app.place', {
      url: '/place/:placeId',
      views: {
        'menuContent': {
          templateUrl: 'templates/place.html',
          controller: 'PlaceCtrl'
        }
      }
    })

    .state('app.search', {
      url: '/search/:query',
      views: {
        'menuContent': {
          templateUrl: 'templates/search.html',
          controller: 'SearchCtrl'
        }
      }
    })

    .state('app.favorites', {
      url: '/favorites',
      views: {
        'menuContent': {
          templateUrl: 'templates/favorites.html',
          controller: 'FavoritesCtrl'
        }
      }
    });

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/app/map');

});

