`import Ember from 'ember'`

get = Ember.get
set = Ember.set
typeOf = Ember.typeOf
ObjectProxy = Ember.ObjectProxy
computed = Ember.computed

# SparseArrayItem uses snake case to try to avoid naming conflicts with
# proxied content

SparseArrayItem = ObjectProxy.extend

  ###
    @property isSparseArrayItem
    @type Boolean
    @default true
    @final
  ###
  isSparseArrayItem: true #quack like a duck

  last_fetched_at: 0

  time_to_live: 36000000

  is_stale: computed('last_fetched_at', 'time_to_live', {
    get: ->
      (get(@, 'last_fetched_at') + get(@, 'time_to_live')) <= Date.now()
  })

  is_loading: computed('content', 'content.isLoading', {
    get: ->
      !get(@, 'content') || get(@, 'content.isLoading')
  })

  resolve: (value) ->
    set(@, 'last_fetched_at', Date.now())
    set(@, 'content', value)
    @



EllaSparseArray = Ember.Object.extend Ember.Array,
  init: ->
    # @_TMP_PROVIDE_ARRAY = []
    # @_TMP_PROVIDE_RANGE = length: 1
    @_TMP_RANGE = {}
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
  data: Ember.A()

  ###
    Hook for initiating requests for the total number of objects available to
    this object in the persistence layer. Instantiate this method to enable
    this object to obtain its length.

    If the request is successful, set the length of this sparse array
    object using the `provideLength` method.

    @method didRequestLength
  ###
  didRequestLength: null

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
    @property isSparseArray
    @type Boolean
    @default true
    @final
  ###
  isSparseArray: true #quack like a duck

  ###
    The number of items to fetch together in a single request. Essentially,
    the "page size" of each query.

    @property rangeSize
    @type {Integer}
    @default 1
  ###
  rangeSize: 10

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
    return result if (result and get(result, 'is_stale') isnt true)
    @requestObjectAt(idx, dontFetch)

  ###
    Fetches data at the specified index. If `rangeSize` is greater than 1, this
    method will also retrieve adjacent items to form a "page" of results.

    @method requestObjectAt
    @param {Integer} idx The index to fetch content for
    @param {Boolean} dontFetch Won't obtain remote data if `true`
    @return {Object|Null} A placeholder object or null if content is empty
  ###
  requestObjectAt: (idx, dontFetch = !get(@, 'isStreaming')) ->
    return (get(@, @_pathForIndex(idx)) ? @insertSparseArrayItem(idx)) if dontFetch

    rangeSize = parseInt(get(@, 'rangeSize'), 10) || 1

    start = Math.floor(idx / rangeSize) * rangeSize
    start = Math.max start, 0
    placeholders = Math.min((start + rangeSize), get(@, 'length'))
    @insertSparseArrayItems([start...placeholders])

    if typeOf(@requestLength) is 'function'
      range = @_TMP_RANGE
      range.start = start
      range.length = rangeSize
      @_didRequestRange(range)
    else
      @_didRequestIndex(i) for i in [start...rangeSize]

    get(@, @_pathForIndex(idx))

  ###
    Fetches data regarding the total number of objects in the
    persistence layer.

    @method requestLength
    @return {Integer} The current known length
  ###
  requestLength: ->
    len = get(@, '_length')

    if typeOf(@requestLength) is 'function' and !get(@, 'isRequestingLength')
      set @, 'isRequestingLength', true
      @_didRequestLength()

    len

  #INJECT PLACEHOLDER OBJECTS

  ###
    Insert a placeholder object at the specified index.

    @method insertSparseArrayItem
    @param {Integer} idx Where to inject a placeholder
    @param {Boolean} force If true, placeholder replaces existing content
    @return {Object}
  ###
  insertSparseArrayItem: (idx, force = false) ->
    currentValue = get(@, @_pathForIndex(idx))
    sparseItem = SparseArrayItem.create()
    set(@, @_pathForIndex(idx), sparseItem) if force or !currentValue?
    get(@, @_pathForIndex(idx))

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
      item.resolve value
    @

  ###
    @private

    Prepare to fetch the total number of available objects from the
    persistence layer.

    @method _didRequestLength
  ###
  _didRequestLength: ->
    @didRequestLength()

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
    @didRequestRange(range)

  ###
    @private

    Prevents the controller from continuously attempting to fetch data for
    objects that are already in the process of being fetched.

    @method _markSparseArrayItemInProgress
    @param {Integer} idx The index of the object to place into a loading state
  ###
  _markSparseArrayItemInProgress: (idx) ->
    item = get(@, @_pathForIndex(idx))
    set(item, 'content', null) if item?
    @

  _pathForIndex: (idx) ->
    ['data', idx].join('.')

  ###
    @private

    Set the data array's length to the length fetched from persistence layer.

    @method _lengthDidChange
  ###
  _lengthDidChange: Ember.observer ->
    length = get(@, 'length') ? 0
    data = get(@, 'data')
    data.length = length if Ember.isArray(data) and data.length isnt length
  , 'length'

`export default EllaSparseArray`
