# Warning: This is a work in progress (WIP)

I accept friendly pull requests and feedback.

Also, use this addon at your own risk. It could be capable of anything including scaring your cat (even if you don't own a cat) or burning your toast (nobody *really* likes burnt toast). Please use caution when using addons that are not yet complete.

# Emberella Sparse Array

Aloha!

Emberella Sparse Array is an Ember CLI addon that provides a sparse array data structure. Its aim is to provide a means for populating an array of data into the client app in "pages" or "chunks" rather than all at once.

For example, imagine you want to show a list with 246,982 records. Well, you could setup routes to paginate the data, showing a few records to the user at a time. Or you could press your luck and try to grab all 246,982 records from your persistence layer at once. Or you could use a sparse array like this one to gradually load only as much data as you need to make the user happy.

# Installation

Ember and Ember CLI are always evolving, so you may wish to verify these instructions in the Ember CLI documentation. As of this writing, you can install this addon by navigating to your project directory in the command line and entering the following:

```bash
ember install ella-sparse-array
```

This will add the Emberella Sparse Array library as a dependency to your app.

# Usage

Anywhere you wish to use the Emberella Sparse Array library, add the following to the top of your Javascript file:

```javascript
import EllaSparseArray from 'ella-sparse-array/lib/sparse-array';
```

Once you have imported a reference to the library, you can instantiate a new sparse array with"

```javascript
var arr = EllaSparseArray.create();
```

Of course, if you do that, you'll get an error when trying to get any data. Sparse Arrays begin life empty and pretty entirely unsure of what type of data they are meant to show. You will have to "teach" your sparse arrays how to get data by providing two data fetching methods: `didRequestLength` and `didRequestRange`.

For example, if you were using Ember Data, you might request length and range like this:

```javascript
var sparseArray = EllaSparseArray.create({
  didRequestLength: function() {
    var _this = this;
    store.query('cat', {page: {offset: 0, limit: 1}}).then(function(response) {
      _this.provideLength(Ember.get(response, 'meta.page.total'));
    });
  },
  didRequestRange: function(range) {
    var _this = this;
    store.query('cat', {page: {offset: range.start, limit: range.length}}).then(function(response) {
      _this.provideLength(Ember.get(response, 'meta.page.total'));
      _this.provideObjectsInRange(range, response.get('content').mapBy('record'));
    });
  }
});
```

**Note: the names of some models have been changed to protect the innocent. Also, this example has not been verified to work as written. See tests for more examples.**

## didRequestLength

Your custom length fetching method should fetch the total number of available objects from the persistence layer. Once you successfully fetch the record count, provide it to the sparse array using the `.provideLength` method.

## didRequestRange

Your custom record fetching method should fetch a "page" of items from the persistence layer. Your custom method will be called with a range object containing a `start` property, the starting index or "offset" of the records to be fetched, and a `length`, the number of items to retrieve.

Once you successfully fetch this batch of records, inject them into the sparse array by calling the `.provideObjectsInRange` method. For example: `sparseArray.provideObjectsInRange(range, fetchedObjectsArray)`.
