import Ember from "ember";
import QUnit from "qunit";
import { test } from 'ember-qunit';
import EllaSparseArray from 'ella-sparse-array/lib/sparse-array';

var TOTAL_RECORDS = 103941;
var requestCount = 0;

var fetchTestObjects = function(offset, limit) {
  var max = TOTAL_RECORDS;

  return new Ember.RSVP.Promise(function(resolve, reject) {
    var response = {};
    var data = [];
    var obj, i;

    for (i = offset; i < offset + limit; ++i) {
      obj = Ember.Object.create({
        id: i + 1,
        note: 'This is item ' + (i + 1),
        updatedAt: Date.now()
      });

      if (i < max) {
        data.push(obj);
      } else {
        i = offset + limit;
      }
    }

    response['data'] = data;
    response['meta'] = {offset: offset, limit: limit, total: max};

    // always succeed
    resolve(response);
    // reject
    reject();
  });
};

var fetchLength = function() {
  return new Ember.RSVP.Promise(function(resolve, reject) {
    // always succeed
    resolve(TOTAL_RECORDS);
    // reject
    reject();
  });
};

var doNothingRequestFunctions = {
  didRequestLength: function() {return this;},
  didRequestRange: function() {return this;}
};

var didRequestFunctions = {
  didRequestLength: function() {
    var _this = this;
    fetchLength().then(function(response) {
      _this.provideLength(response);
    });
  },
  didRequestRange: function(range) {
    var _this = this;

    console.log("Requesting ::", range);

    requestCount = requestCount + 1;

    fetchTestObjects(range['start'], range['length']).then(function(response) {
      _this.provideLength(response.meta.total);
      _this.provideObjectsInRange(range, response['data']);
    });
  }
};

QUnit.module('ella-sparse-array:lib:sparse-array', {
  unit: true,
  beforeEach: function() {
    requestCount = 0;
  }
});

test('Sparse array exists', function(assert) {
  assert.expect(2);
  assert.ok(EllaSparseArray);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  assert.ok(arr.get('isSparseArray'));
});

test('Sparse array instantiates with _length of null', function(assert) {
  assert.expect(1);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  assert.equal(arr.get('_length'), null);
});

test('Sparse array instantiates with isLength of false', function(assert) {
  assert.expect(1);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  assert.equal(arr.get('isLength'), false);
});

test('Sparse array length starts at 0', function(assert) {
  assert.expect(1);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  assert.equal(arr.get('length'), 0);
});

test('Sparse array ttl starts at 36000000', function(assert) {
  assert.expect(1);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  assert.equal(arr.get('ttl'), 36000000);
});

test('Sparse array rangeSize starts at 10', function(assert) {
  assert.expect(1);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  assert.equal(arr.get('rangeSize'), 10);
});

test('Sparse array isStreaming starts at true', function(assert) {
  assert.expect(1);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  assert.equal(arr.get('isStreaming'), true);
});

test('Sparse array isRequestingLength updates when length requested', function(assert) {
  assert.expect(2);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  assert.equal(arr.get('isRequestingLength'), false);
  arr.get('length');
  assert.equal(arr.get('isRequestingLength'), true);
});

test('Sparse array expired starts at 0', function(assert) {
  assert.expect(1);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  assert.equal(arr.get('expired'), 0);
});

test('.provideLength sets the length property and updates isRequestingLength', function(assert) {
  assert.expect(3);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  var l = 142;
  assert.equal(arr.get('length'), 0);
  arr.provideLength(l);
  assert.equal(arr.get('isRequestingLength'), false);
  assert.equal(arr.get('length'), l);
});

test('.objectAt initially returns stale SparseArrayItems', function(assert) {
  assert.expect(2);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  var item = arr.objectAt(0);

  assert.equal(item.get('isSparseArrayItem'), true);
  assert.equal(item.get('is_stale'), true);
});

test('.objectAt returns `undefined` if requested index out of range', function(assert) {
  assert.expect(2);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  var l = 142;
  var item;
  arr.provideLength(l);

  item = arr.objectAt(-1);
  assert.ok('undefined' === typeof(item));

  item = arr.objectAt(l);
  assert.ok('undefined' === typeof(item));
});

test('firstObject returns object at index 0', function(assert) {
  assert.expect(2);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  var item1, item2;

  item1 = arr.get('firstObject');
  item2 = arr.objectAt(0);

  assert.equal(item1.get('isSparseArrayItem'), true);
  assert.equal(item1, item2);
});

test('lastObject returns object at index (length - 1)', function(assert) {
  assert.expect(3);
  var arr = EllaSparseArray.create(doNothingRequestFunctions);
  var l = 142;
  var item1, item2;

  item1 = arr.get('lastObject');
  assert.ok('undefined' === typeof(item1));

  arr.provideLength(l);
  item1 = arr.get('lastObject');
  item2 = arr.objectAt(l - 1);

  assert.equal(item1.get('isSparseArrayItem'), true);
  assert.equal(item1, item2);
});

test('Item properties are updated once fetched', function(assert) {
  assert.expect(2);
  var arr = EllaSparseArray.create(didRequestFunctions);
  var deferred = Ember.RSVP.defer();
  var note = 'This is item ';
  var item1, item2;

  Ember.run(function() {
    arr.get('length');
    item1 = arr.objectAt(0);
    item2 = arr.objectAt(723);
  });

  Ember.run.later(function() {
    deferred.resolve();
  }, 50);

  return deferred.promise.then(function() {
    assert.equal(item1.get('note'), note + '1');
    assert.equal(item2.get('note'), note + '724');
  });
});

test('.objectAt does not fetch data when sent a truthy second argument', function(assert) {
  assert.expect(2);
  var arr = EllaSparseArray.create(didRequestFunctions);
  var deferred = Ember.RSVP.defer();
  var item1, item2;

  Ember.run(function() {
    arr.get('length');
    item1 = arr.objectAt(0, true);
    item2 = arr.objectAt(723, true);
  });

  Ember.run.later(function() {
    deferred.resolve();
  }, 50);

  return deferred.promise.then(function() {
    assert.ok(!item1.get('content'));
    assert.ok(!item2.get('content'));
  });
});

test('.objectsAt assembles an array of SparseArrayItems', function(assert) {
  assert.expect(5);
  var arr = EllaSparseArray.create(didRequestFunctions);
  var deferred = Ember.RSVP.defer();
  var note = 'This is item ';
  var items;

  Ember.run(function() {
    arr.get('length');
    items = arr.objectsAt([3, 5, 34567, 101456, 9]);
  });

  Ember.run.later(function() {
    deferred.resolve();
  }, 50);

  return deferred.promise.then(function() {
    assert.equal(items[0].get('note'), note + '4');
    assert.equal(items[1].get('note'), note + '6');
    assert.equal(items[2].get('id'), '34568');
    assert.equal(items[3].get('note'), note + '101457');
    assert.equal(items[4].get('note'), note + '10');
  });
});

test('.unset removes content from SparseArrayItems and marks them stale', function(assert) {
  assert.expect(36);
  var arr = EllaSparseArray.create(didRequestFunctions);
  var deferred = Ember.RSVP.defer();
  var note = 'This is item ';
  var items;

  Ember.run(function() {
    arr.get('length');
    items = arr.objectsAt([32, 723, 15699, 99999, 101457, 6]);
  });

  Ember.run.later(function() {
    deferred.resolve();
  }, 50);

  return deferred.promise.then(function() {
    assert.equal(items[0].get('note'), note + '33');
    assert.equal(items[1].get('note'), note + '724');
    assert.equal(items[2].get('id'), '15700');
    assert.equal(items[3].get('note'), note + '100000');
    assert.equal(items[4].get('note'), note + '101458');
    assert.equal(items[5].get('note'), note + '7');

    assert.equal(items[0].get('is_stale'), false);
    assert.equal(items[1].get('is_stale'), false);
    assert.equal(items[2].get('is_stale'), false);
    assert.equal(items[3].get('is_stale'), false);
    assert.equal(items[4].get('is_stale'), false);
    assert.equal(items[5].get('is_stale'), false);

    arr.unset(6);

    assert.equal(items[0].get('note'), note + '33');
    assert.equal(items[1].get('note'), note + '724');
    assert.equal(items[2].get('id'), '15700');
    assert.equal(items[3].get('note'), note + '100000');
    assert.equal(items[4].get('note'), note + '101458');
    assert.equal(items[5].get('content'), null);

    arr.unset(32, 723);

    assert.equal(items[0].get('content'), null);
    assert.equal(items[1].get('content'), null);
    assert.equal(items[2].get('id'), '15700');
    assert.equal(items[3].get('note'), note + '100000');
    assert.equal(items[4].get('note'), note + '101458');
    assert.equal(items[5].get('content'), null);

    arr.unset([32], [723, [15699]], [[99999], 101457]);

    assert.equal(items[0].get('content'), null);
    assert.equal(items[1].get('content'), null);
    assert.equal(items[2].get('content'), null);
    assert.equal(items[3].get('content'), null);
    assert.equal(items[4].get('content'), null);
    assert.equal(items[5].get('content'), null);

    assert.equal(items[0].get('is_stale'), true);
    assert.equal(items[1].get('is_stale'), true);
    assert.equal(items[2].get('is_stale'), true);
    assert.equal(items[3].get('is_stale'), true);
    assert.equal(items[4].get('is_stale'), true);
    assert.equal(items[5].get('is_stale'), true);
  });
});

test('SparseArrayItem time_to_live inherits SparseArray ttl', function(assert) {
  assert.expect(2);
  var arr = EllaSparseArray.create({
    didRequestLength: doNothingRequestFunctions.didRequestLength,
    didRequestRange: doNothingRequestFunctions.didRequestRange,
    ttl: 50
  });
  var item;

  item = arr.objectAt(0);

  assert.equal(item.get('time_to_live'), arr.get('ttl'));
  assert.equal(item.get('time_to_live'), 50);
});

test('SparseArrayItem appears stale after ttl ms', function(assert) {
  assert.expect(2);
  var deferred = Ember.RSVP.defer();
  var arr = EllaSparseArray.create(didRequestFunctions);
  var item;

  Ember.run(function() {
    arr.get('length');
    item = arr.objectAt(0);
  });

  Ember.run.later(function() {
    deferred.resolve();
  }, 50);

  return deferred.promise.then(function() {
    assert.equal(item.get('is_stale'), false);
    item.set('time_to_live', 10);
    assert.equal(item.get('is_stale'), true);
  });
});

test('SparseArrayItem .isExpiredAt initially returns true', function(assert) {
  assert.expect(1);
  var arr = EllaSparseArray.create(didRequestFunctions);
  var item;

  item = arr.objectAt(0, true);
  assert.equal(item.isExpiredAt(arr.get('expired')), true);
});

test('SparseArrayItem .isExpiredAt returns false while loading and after item is resolved', function(assert) {
  assert.expect(4);
  var deferred = Ember.RSVP.defer();
  var arr = EllaSparseArray.create(didRequestFunctions);
  var item;

  arr.get('length');
  item = arr.objectAt(0);

  assert.equal(item.get('is_loading'), true);
  assert.equal(item.isExpiredAt(arr.get('expired')), false);

  Ember.run.later(function() {
    deferred.resolve();
  }, 50);

  return deferred.promise.then(function() {
    assert.equal(item.get('is_loading'), false);
    assert.equal(item.isExpiredAt(arr.get('expired')), false);
  });
});

test('SparseArray only requests each page once', function(assert) {
  assert.expect(3);
  var arr = EllaSparseArray.create(didRequestFunctions);
  var deferred = Ember.RSVP.defer();
  var note = 'This is item ';
  var items;

  Ember.run(function() {
    arr.get('length');
    items = arr.objectsAt([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  Ember.run.later(function() {
    deferred.resolve();
  }, 50);

  return deferred.promise.then(function() {
    assert.equal(items[0].get('note'), note + '1');
    assert.equal(items[9].get('note'), note + '10');
    assert.equal(requestCount, 1);
  });
});

test('Calling .expire causes SparseArrayItems to appear stale', function(assert) {
  assert.expect(4);
  var deferred = Ember.RSVP.defer();
  var arr = EllaSparseArray.create(didRequestFunctions);
  var item;

  arr.get('length');
  item = arr.objectAt(0);

  Ember.run.later(function() {
    deferred.resolve();
  }, 50);

  return deferred.promise.then(function() {
    assert.equal(item.get('is_loading'), false);
    assert.equal(item.isExpiredAt(arr.get('expired')), false);

    Ember.run(function() {
      arr.expire();
    });

    assert.equal(item.get('is_loading'), false);
    assert.equal(item.isExpiredAt(arr.get('expired')), true);
  });
});

test('Calling .expire causes SparseArrayItems to be fetched again', function(assert) {
  assert.expect(4);
  var deferred1 = Ember.RSVP.defer(), deferred2 = Ember.RSVP.defer();
  var arr = EllaSparseArray.create(didRequestFunctions);
  var items, upinit_1, upinit_2, upinit_3, upaft_1, upaft_2, upaft_3;

  items = arr.objectsAt([4, 5, 6, 3110, 78901]);

  Ember.run.later(function() {
    deferred1.resolve();
  }, 50);

  deferred1.promise.then(function() {
    upinit_1 = items[0].get('updatedAt');
    upinit_2 = items[2].get('updatedAt');
    upinit_3 = items[4].get('updatedAt');

    arr.expire();

    items = arr.objectsAt([4, 5, 6, 3110, 78901]);

    Ember.run.later(function() {
      deferred2.resolve();
    }, 50);
  });

  return deferred2.promise.then(function() {
    upaft_1 = items[0].get('updatedAt');
    upaft_2 = items[2].get('updatedAt');
    upaft_3 = items[4].get('updatedAt');
    assert.ok(upaft_1 > upinit_1);
    assert.ok(upaft_2 > upinit_2);
    assert.ok(upaft_3 > upinit_3);

    assert.equal(requestCount, 6);
  });
});

test('lastObject matches item at index length - 1', function(assert) {
  assert.expect(2);
  var deferred1 = Ember.RSVP.defer(), deferred2 = Ember.RSVP.defer();
  var arr = EllaSparseArray.create(didRequestFunctions);
  var item1, item2;

  arr.get('length');

  Ember.run.later(function() {
    deferred1.resolve();
  }, 50);

  deferred1.promise.then(function() {
    item1 = arr.get('lastObject');
    item2 = arr.objectAt(TOTAL_RECORDS - 1);

    Ember.run.later(function() {
      deferred2.resolve();
    }, 50);
  });

  return deferred2.promise.then(function() {
    assert.equal(item1, item2);
    assert.equal(item1.get('note'), 'This is item ' + (TOTAL_RECORDS));
  });
});

