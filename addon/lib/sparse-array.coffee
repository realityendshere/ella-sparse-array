`import Ember from 'ember'`

get = Ember.get
set = Ember.set
setProperties = Ember.setProperties
typeOf = Ember.typeOf
ObjectProxy = Ember.ObjectProxy
computed = Ember.computed
observer = Ember.observer

DEFAULT_TTL = 36000000

# SparseArrayItem uses snake case to try to avoid naming conflicts with
# proxied content

###
  `SparseArrayItem` is an object proxy for managing individual items in
  an `EllaSparseArray`.

  @class SparseArrayItem
###

SparseArrayItem = ObjectProxy.extend

  ###
    @property isSparseArrayItem
    @type Boolean
    @default true
    @final
  ###
  isSparseArrayItem: true #quack like a duck

  ###
    The Javascript Unix timestamp representing the last time the content for
    this item was provided.

    @property last_fetched_at
    @type Integer
    @default 0
  ###
  last_fetched_at: 0

  ###
    The number of ms until this item is automatically considered stale.
    The default value is 10 minutes.

    @property time_to_live
    @type Integer
    @default 36000000
  ###
  time_to_live: DEFAULT_TTL

  ###
    Loading state of the item.

    @property is_loading
    @type Boolean
    @default false
  ###
  is_loading: false

  ###
    Helps to determine if this item should be fetched or not.

    @property is_stale
    @type Boolean
    @default true
  ###
  is_stale: computed('last_fetched_at', 'time_to_live', {
    get: ->
      (get(@, 'last_fetched_at') + get(@, 'time_to_live')) <= Date.now()
  })

  ###
    Provide fetched content this item should represent.

    @method resolve
    @param {Object} The content for this item
    @chainable
  ###
  resolve: (value) ->
    setProperties(@, {
      content: value
      is_loading: false
      last_fetched_at: Date.now()
    })

    @

  ###
    Clear the content from this item and mark it stale.

    @method resetItem
    @chainable
  ###
  resetItem: ->
    setProperties(@, {
      content: null
      last_fetched_at: 0
    })
    @

  ###
    Given a timestamp, determines if the content should be fetched from the
    persistence layer.

    @method isExpiredAt
    @param {Integer} A timestamp
    @return {Boolean}
  ###
  isExpiredAt: (timestamp = 0) ->
    return false if get(@, 'is_loading')
    !!(get(@, 'is_stale') or get(@, 'last_fetched_at') <= timestamp)


###
  `EllaSparseArray` provides an array-like structure that can fetch portions of
  data from a persistence layer on demand.

  @example
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

  @class EllaSparseArray
###

EllaSparseArray = Ember.Object.extend Ember.Array,
  init: ->
    set(@, 'data', Ember.A())
    @_super()

  ###
    @private

    Stash the potential total number of items as reported by the
    persistence layer.

    @property _length
    @type {Integer}
    @default null
  ###
  _length: null

  ###
    The array where sparse data gets stashed.

    @property data
    @type {Array}
    @default []
  ###
  data: null

  ###
    Hook for initiating requests for the total number of objects available to
    this object in the persistence layer. Instantiate this method to enable
    this object to obtain its length.

    If the request is successful, set the length of this sparse array
    object using the `provideLength` callback method.

    @method didRequestLength
  ###
  didRequestLength: ->
    Ember.assert('Define a custom `didRequestLength` function to enable EllaSparseArray to fetch length data')
    @provideLength(get(@, '_length') ? 0)
    @

  ###
    Hook for range requests. Override this method to enable this sparse array
    to obtain a page of persisted data.

    If the request is successful, insert the fetched objects into the sparse
    array using the `provideObjectsInRange` method.

    @method didRequestRange
    @param {Object} [range] A range object
      @param {Integer} [range.start]
        The index to fetch
      @param {Integer} [range.length]
        The number of items to fetch
  ###
  didRequestRange: null

  ###
    Hook for single object requests. Override this method to enable this
    controller to obtain a single persisted object.

    If the request is successful, insert the fetched object into the sparse
    array using the `provideObjectAtIndex` method.

    @method didRequestIndex
    @param {Integer} idx
  ###
  didRequestIndex: ->
    Ember.assert('Define a custom `didRequestIndex` or `didRequestRange` function to enable EllaSparseArray to fetch data')
    @

  ###
    @property isSparseArray
    @type Boolean
    @default true
    @final
  ###
  isSparseArray: true #quack like a duck

  ###
    Any items resolved prior to this time should be considered stale.

    @property expired
    @type {Integer}
    @default 0
  ###
  expired: 0

  ###
    Flag to indicate if this sparse array should attempt to fetch data.

    @property isStreaming
    @type {Boolean}
    @default true
  ###
  isStreaming: true

  ###
    True if this sparse array instance is attempting to fetch its length.

    @property isRequestingLength
    @type {Boolean}
    @default false
  ###
  isRequestingLength: false

  ###
    The number of items to fetch together in a single request. Essentially,
    the "page size" of each query.

    @property rangeSize
    @type {Integer}
    @default 10
  ###
  rangeSize: 10

  ###
    How long until a previously loaded item becomes stale.
    Default is 10 minutes.

    @property ttl
    @type {Integer}
    @default 36000000
  ###
  ttl: DEFAULT_TTL

  ###
    The total number of potential items in the sparse array. If the length is
    unknown, requesting this property will cause this instance to try to fetch
    the total length from the persistence layer.

    @property length
    @type {Integer}
    @default 0
    @readOnly
  ###
  length: computed('_length', 'isLength', {
    get: ->
      if get(@, 'isLength')
        get(@, '_length')
      else
        @requestLength()
        0
  })

  ###
    True if remote length value fetched. False if length is null or invalid.

    @property isLength
    @type {Boolean}
    @default false
    @readOnly
  ###
  isLength: computed('_length', {
    get: ->
      typeOf(get(@, '_length')) is 'number'
  })

  ###
    True if remote length value not fetched.

    @property isLoading
    @type {Boolean}
    @default true
  ###
  isLoading: computed.not 'isLength'

  ###
    The last object in the sparse array (will fetch the last "page" of data).

    @property lastObject
    @type {Mixed}
    @default undefined
    @readOnly
  ###
  lastObject: computed('length', {
    get: ->
      len = get(@, 'length')
      return undefined if len is 0
      @objectAt(len - 1)
  })

  ###
    Enable data fetching.

    @method enableRequests
    @chainable
  ###
  enableRequests: ->
    set(@, 'isStreaming', true)
    @

  ###
    Disable data fetching.

    @method disableRequests
    @chainable
  ###
  disableRequests: ->
    set(@, 'isStreaming', false)
    @

  ###
    Get the data from the specified index.

    If an object is found at a given index, it will be returned immediately.

    Otherwise, a "stale" placeholder object will be returned and a new remote
    query to fetch the data for the given index will be created.

    @method objectAt
    @param {Integer} idx The index to obtain content for
    @param {Boolean} dontFetch Won't obtain remote data if `true`
    @return {Object}
  ###
  objectAt: (idx, dontFetch = false) ->
    # Arrays and negative indexes don't mix
    return undefined if idx < 0

    # Allow to proceed if length hasn't been determined yet
    return undefined if get(@, 'isLength') and idx >= get(@, 'length')

    result = get(@, @_pathForIndex(idx)) ? @insertSparseArrayItem(idx)
    if (result and result.isExpiredAt(get(@, 'expired')) isnt true)
      return result
    @_requestObjectAt(idx, dontFetch)

  ###
    Fetches data regarding the total number of objects in the
    persistence layer.

    @method requestLength
    @return {Integer} The current known length
  ###
  requestLength: ->
    len = get(@, '_length')

    if typeOf(@didRequestLength) is 'function' and !get(@, 'isRequestingLength')
      set @, 'isRequestingLength', true
      @_didRequestLength()

    len

  ###
    All items will appear to be stale when fetching with `.objectAt`.

    @method expire
    @chainable
  ###
  expire: ->
    set(@, 'expired', Date.now())
    @

  ###
    Empty the sparse data. (The "nuclear option.")

    @method reset
    @chainable
  ###
  reset: ->
    @beginPropertyChanges()
    len = get(@, '_length')
    @_clearData()
    set(@, '_length', len)
    @endPropertyChanges()
    @

  ###
    Uncache the item at the specified index.

    @method unset
    @param {Integer} idx The index to unset
    @chainable
  ###
  unset: (idx...) ->
    indexes = [].concat.apply([], idx)
    @_unset(i) for i in indexes
    @

  #INJECT PLACEHOLDER OBJECTS

  ###
    Insert a placeholder object at the specified index.

    @method insertSparseArrayItem
    @param {Integer} idx Where to inject a placeholder
    @return {Object}
  ###
  insertSparseArrayItem: (idx) ->
    path = @_pathForIndex(idx)
    if !get(@, path)?
      set(@, path, SparseArrayItem.create(time_to_live:  get(@, 'ttl')))
    get(@, path)

  ###
    Insert placeholder objects at the specified indexes.

    @method insertSparseArrayItems
    @param {Integer|Array} idx Multiple indexes
    @chainable
  ###
  insertSparseArrayItems: (idx...) ->
    @insertSparseArrayItem(i) for i in [].concat.apply([], idx)
    @

  # CALLBACK METHODS FOR LOADING FETCHED DATA

  ###
    Async callback to provide total number of objects available to this
    controller stored in the persistence layer.

    @method provideLength
    @param {Integer} length The total number of available objects
    @chainable
  ###
  provideLength: (length) ->
    set @, '_length', length
    set @, 'isRequestingLength', false
    @_lengthDidChange()
    @

  ###
    Async callback to provide objects in a specific range.

    @method provideObjectsInRange
    @param {Object} [range] A range object
      @param {Integer} [range.start]
        The index at which objects should be inserted into the content array
      @param {Integer} [range.length]
        The number of items to replace with the updated data
    @param {Array} array The data to inject into the sparse array
    @chainable
  ###
  provideObjectsInRange: (range, array) ->
    for value, idx in array
      item = get(@, @_pathForIndex(range.start + idx))
      item?.resolve(value)
    @

  ###
    @private

    Empty the sparse array.

    @method _clearSparseContent
  ###
  _clearData: ->
    data = get(@, 'data')

    if data and 'function' is typeOf(data.clear)
      data.clear()
    else
      set(@, 'data', Ember.A())
    @

  ###
    @private

    Fetches data at the specified index. If `rangeSize` is greater than 1, this
    method will also retrieve adjacent items to form a "page" of results.

    @method _requestObjectAt
    @param {Integer} idx The index to fetch content for
    @param {Boolean} dontFetch Won't obtain remote data if `true`
    @return {Object|Null} A placeholder object or null if content is empty
  ###
  _requestObjectAt: (idx, dontFetch = !get(@, 'isStreaming')) ->
    return (get(@, @_pathForIndex(idx)) ? @insertSparseArrayItem(idx)) if dontFetch

    rangeSize = parseInt(get(@, 'rangeSize'), 10) || 1

    start = Math.floor(idx / rangeSize) * rangeSize
    start = Math.max start, 0
    placeholders = start + rangeSize
    placeholders = Math.min(placeholders, get(@, 'length')) if get(@, 'isLength')

    @insertSparseArrayItems([start...placeholders])

    if typeOf(@didRequestRange) is 'function'
      @_didRequestRange({start: start, length: rangeSize})
    else
      @_didRequestIndex(i) for i in [start...rangeSize]

    get(@, @_pathForIndex(idx))


  ###
    @private

    Prepare to fetch the total number of available objects from the
    persistence layer.

    @method _didRequestLength
  ###
  _didRequestLength: ->
    @didRequestLength.call(@)

  ###
    @private

    Prepare to fetch a page of data from the persistence layer.

    @method _didRequestRange
    @param {Object} [range] A range object
      @param {Integer} [range.start]
        The index to fetch
      @param {Integer} [range.length]
        The number of items to fetch
  ###
  _didRequestRange: (range) ->
    @_markSparseArrayItemInProgress(idx) for idx in [range.start...(range.start + range.length)]
    @didRequestRange.call(@, range)

  ###
    @private

    Prepare to fetch a single object from the persistence layer.

    @method _didRequestIndex
    @param {Integer} idx
  ###
  _didRequestIndex: (idx) ->
    @_markSparseArrayItemInProgress(idx)
    @didRequestIndex.call(@, idx)

  ###
    @private

    Prevents the controller from continuously attempting to fetch data for
    objects that are already in the process of being fetched.

    @method _markSparseArrayItemInProgress
    @param {Integer} idx The index of the object to place into a loading state
  ###
  _markSparseArrayItemInProgress: (idx) ->
    item = get(@, @_pathForIndex(idx))
    if item?
      setProperties(item, {
        content: null
        is_loading: true
      })
    @

  ###
    @private

    Uncache the item at the specified index.

    @method _unset
    @param {Integer} idx The index to unset
    @chainable
  ###
  _unset: (idx) ->
    return @ unless idx?
    item = get(@, @_pathForIndex(idx))
    item?.resetItem()
    @

  _pathForIndex: (idx) ->
    ['data', idx].join('.')

  ###
    @private

    Set the data array's length to the length fetched from persistence layer.

    @method _lengthDidChange
  ###
  _lengthDidChange: observer('length', ->
    length = get(@, 'length')
    data = get(@, 'data')
    data.length = length if Ember.isArray(data) and data.length isnt length
  )

`export default EllaSparseArray`
