import Ember from "ember";
import { test } from 'ember-qunit';
import EllaSparseArray from 'ella-sparse-array/lib/sparse-array';

var TOTAL_RECORDS = 103935;

var fetchTestObjects = function(offset, limit) {
  var max = TOTAL_RECORDS;

  return new Ember.RSVP.Promise(function(resolve, reject) {
    var response = {};
    var data = [];
    var obj, i;

    for (i = offset; i < offset + limit; ++i) {
      obj = Ember.Object.create({
        id: i + 1,
        note: 'This is item ' + (i + 1)
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

    fetchTestObjects(range['start'], range['length']).then(function(response) {
      _this.provideLength(response.meta.total);
      _this.provideObjectsInRange(range, response['data']);
    });
  },
};



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



