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

    //initialize facebook
    ngFB.init({appId: '1442526929123214'});
  });
});

app.config(function($stateProvider, $urlRouterProvider, BackandProvider,$httpProvider) {
  //Backand Settings
  BackandProvider.setAppName('tafervendo');
  BackandProvider.setAnonymousToken('3560099e-ff06-497d-82bd-d98405dbb040');
  $httpProvider.interceptors.push(httpInterceptor);
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
    });

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/app/map');

});

