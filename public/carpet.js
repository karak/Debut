Array.prototype.shuffle = function() {
    var i = this.length;
    while(i){
        var j = Math.floor(Math.random()*i);
        var t = this[--i];
        this[i] = this[j];
        this[j] = t;
    }
    return this;
};

ko.observableArray.fn.shuffle = function () {
    this.valueWillMutate();
    this().shuffle();
    this.valueHasMutated();
};


/* export */
var carpet = {};

(function () {

var doNothing = function () {};
var alwaysTrue = function () { return false; }
var isFunction = carpet.isFunction = function (x) {
    var getType = {};
    return x && getType.toString.call(x) === '[object Function]';
};

/******** Collections ********/

var QueryPrototypeMixin = (function () {
    var methods = {
        all: function () {
            var result = new Array();
            this.forEach(function (item) {
                result.push(item);
            });
            return result;
        },
        count: function () {
            var i = 0;
            this.forEach(function (item) {
                ++i;
            });
            return i;
        },
        map: function (fn) {
            var result = new Array();
            this.forEach(function () {
                result.push(fn.apply(this, arguments));
            });
            return result;
        },
        reduce: function (fn, initial) {
            var result = initial;
            this.forEach(function (item, i, self) {
                result = fn.apply(this, [result, item, i, self]);
            });
            return result;
        },
        sum: function () {
            return this.reduce(function (total, x) { return total + x; }, 0);
        },
        
        offset: function (n) {
            return new Offset(this, n);
        },
        limit: function (n) {
            return new Limit(this, n);
        },
        where: function (pred) {
            return new Where(this, pred);
        }
    };
    var Where = function (source, pred)  {
        this._source = source;
        this._pred = pred;
    };
    $.extend(Where.prototype, methods);
    Where.prototype.forEach = function (fn) {
        var self = this,
            source = this._source,
            pred = this._pred;
        source.forEach (function () {
            if (pred.apply(self, arguments)) {
                if (fn.apply(self, arguments) === false)
                    return false;
            }
        });
        return this;
    };
    
    var Offset = function (source, min)  {
        this._source = source;
        this._min = min;
    };
    $.extend(Offset.prototype, methods);
    Offset.prototype.forEach = function (fn) {
        var self = this,
            source = this._source,
            i0 = this._min;
        source.forEach (function (item, i, source) {
            i -= i0;
            if (i >= 0) {
                if (fn.apply(this, [item, i, source]) === false)
                    return false;
            }
        });
        return this;
    };
    
    var Limit = function (source, max)  {
        this._source = source;
        this._max = max;
    };
    $.extend(Limit.prototype, methods);
    Limit.prototype.forEach = function (fn) {
        var self = this,
            source = this._source,
            n = this._max,
            i = 0;
        source.forEach (function () {
            if (i >= n)
                return false;
            
            if (fn.apply(self, arguments) === false)
                return false;
            ++i;
        });
        return this;
    };
    
    return function () {
        $.extend(this, methods);
    };
} ());

carpet.mixinQuery = function (obj) {
    QueryPrototypeMixin.call(obj);
};

//modify built-in array
QueryPrototypeMixin.call(Array.prototype);

////////////////////////////////////////////////////////////////

var createEx = carpet.createEx = function (prototype/*, mixin1, mixi2*/) {
    var mixins = Array.prototype.slice.call(arguments, 1);
    var instance = Object.create(prototype);
    mixins.forEach(function (mixin) {
        mixin.call(instance);
    });
    return instance;
};

var instanciate = function (cardPrototype, source) {
    var instance = Object.create(cardPrototype);
    if (arguments.length < 2) source = null;
    instance.which = function () {
        return cardPrototype;
    };
    instance.naked = function () {
        return this;
    };
    instance.moveTo = function (destination) {
        if (source !== null) {
            source.remove(instance);
            source = null;
        }
        destination.push(instance);
    };
    return instance;
};

var newProxy = (function (mixin) {
    var CardInstanceMixin = function () {
        var self = this;
        this.naked = function () { return self; }
        this.moveTo = function (destination) {
            destination.push(this);
        };
    };
    
    return function (which) {
        return carpet.createEx(which, CardInstanceMixin, mixin);
    };
} ());

carpet.Bag = (function () {
    var Bag = function (cards) {
        var self = this;
        var items = ko.observableArray(cards? cards.map(function (card) { return instanciate(card.which(), self); }) : []);
        self._items = items;
        self.all = ko.computed(function () { return items(); }, self);
        self.count = ko.computed(function () { return items().length; }, self);
    };
    QueryPrototypeMixin.call(Bag.prototype);
    
    Bag.prototype.forEach = function (fn) {
        var i, items;
        items = this._items();
        for (i = 0; i < items.length; ++i) {
            if (fn.apply(this, [items[i], i, this]) === false)
                break;
        }
        return this;
    };
    
    Bag.prototype.push = function (cardOrCards) {
        var self = this;
        if (!(cardOrCards instanceof Array)) {
            var card = cardOrCards;
            var item = instanciate(card.which(), self);
            self._items.push(item);
        } else {
            console.log('BAG');
            var cards = cardOrCards;
            self._items.valueWillMutate();
            var itemsUnwrapped = self._items();
            cards.forEach(function (card, i) {
                var item = instanciate(card.which(), self);
                itemsUnwrapped.push(item);
            });
            self._items.valueHasMutated();
        }
        return self;
    };
    
    Bag.prototype.remove = function (item) {
        this._items.remove(this._items.indexOf(item));
        return this;
    };
    
    Bag.prototype.moveTo = function (destination) {
        var tmp = this._items();
        this._items([]);
        destination.push(tmp);
        return this;
    };
    
    return Bag;
} ());

//TODO: stackOf(cardPrototype)/StackGeneric
carpet.Stack = (function () {
    var Stack = function (cards) {
        var self = this;
        var items = ko.observableArray(cards? cards.map(function (card) { return instanciate(card.which(), self); }) : []);
        this._items = items;
        this.observe = ko.computed(function () {
            items(); //fire
            return this;
        }, this);
        this.all = ko.computed(function () {
            var clone = items().slice(0);
            clone.reverse();
            return clone;
        }, this);
        this.count = ko.computed(function () { return items().length; }, this);
    };
    
    QueryPrototypeMixin.call(Stack.prototype);
    
    Stack.prototype.forEach = function (fn) {
        var i, items;
        items = this._items();
        for (i = items.length - 1; i >= 0; --i) {
            if (fn.apply(this, [items[i], i, this]) === false)
                break;
        }
        return this;
    };
    
    Stack.prototype.toString = function () {
        return this._items().map(function (item) { return item.displayName; }).join(', ');
    };
    
    Stack.prototype.shuffle = function () {
        this._items.shuffle();
        return this;
    };

    Stack.prototype.push = function (cardOrCards) {
        var self = this;
        if (!(cardOrCards instanceof Array)) {
            var card = cardOrCards
            var item = instanciate(card.which(), self);
            self._items.push(item);
        } else {
            var cards = cardOrCards;
            self._items.valueWillMutate();
            var itemsUnwrapped = self._items();
            cards.forEach(function (card, i) {
                var item = instanciate(card.which(), self);
                itemsUnwrapped.push(item);
            });
            self._items.valueHasMutated();
        }
        return self;
    };
    
    Stack.prototype.remove = function (item) {
        this._items.remove(this._items.indexOf(item));
        return this;
    };
    
    Stack.prototype.moveTo = function (destination) {
        var tmp = this._items();
        this._items([]);
        destination.push(tmp);
        return this;
    };
    
    return Stack;
} ());

//extended collections
carpet.Supply = (function () {
    var unlimitedCriteria = {
        available: alwaysTrue,
        increase: doNothing,
        decrease: doNothing
    };
    
    var LimitedCriteria = function (count) {
        count = ko.observable(count || 0);
        
        this.available = ko.computed(function () { return count() > 0; }, this);
        this.count = ko.computed(function () { return count(); }, this);
        this.increase = function () {
            count(count() + (arguments.length > 0? arguments[0] : 1));
        };
        this.decrease = function (delta) {
            count(count() - (arguments.length > 0? arguments[0] : 1));
            return this;
        };
    };
    
    var Supply = function (cardPrototype, limit) {
        var criteria = (limit !== undefined)? new LimitedCriteria(limit) : unlimitedCriteria;
        
        this._which = cardPrototype;
        this.numberOfRemaining = ko.computed(function () {
            return (criteria.count? criteria.count() : '');
        }, this);
        this.available = criteria.available;
        this.push = function (card) {
            if (card.which() !== cardPrototype) throw 'This card is not of this.';
            
            criteria.increase();
            return this;
        };
        this.pop = function () {
            var self = this;
            if (arguments.length === 0) {
                var popped = instanciate(cardPrototype);
                criteria.decrease();
                return popped;
            } else {
                var n = arguments[0], i;
                var allPopped = new Array(n);
                for (i = 0; i < n; ++i)
                    allPopped[i] = instanciate(cardPrototype);
                criteria.decrease(n);
                return new carpet.Bag(allPopped);
            }
        };
    };
    
    Supply.prototype.which = function () {
        return this._which;
    };
    
    return Supply;
} ());

} ());
