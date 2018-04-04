/* 
 * Simple SVG Treemap Chart
 */

export default function(config, helper) {

  var Treemap = Object.create(helper);

  Treemap.init = function(config) {
    var vm = this;
    vm._config = config ? config : {};
    vm._config._padding = 3;
    vm._config._format = d3.format(",.1f");
    vm._config._labels = false;
    vm._config.tip = function(d) {
      var html = '<div>';
      html += '<span>' + d.data.name + "</span><br><span>" + vm._config._format(d.value) + '</span>';
      html += '</div>';
      return html;
    };
    vm._data = [];
    vm._scales = {
      color: d3.scaleOrdinal(d3.schemeCategory20c)
    };
    vm._axes = {};
    vm._tip = d3.tip()
      .attr('class', 'd3-tip tip-treemap')
      .direction('n')
      .html(vm._config.tip);
  }

  Treemap.size = function(col) {
    var vm = this;
    vm._config._size = col;
    return vm;
  }

  Treemap.colors = function(arrayOfColors) {
    var vm = this;
    vm._scales.color = d3.scaleOrdinal(arrayOfColors);
    return vm;
  }

  Treemap.padding = function(padding) {
    var vm = this;
    vm._config._padding = padding;
    return vm;
  }

  Treemap.nestBy = function(keys) {
    var vm = this;
    if (Array.isArray(keys)) {
      if (keys.length == 0)
        throw "Error: nestBy() array is empty";
      vm._config._keys = keys;
    } else if (typeof keys === 'string' || keys instanceof String) {
      vm._config._keys = [keys];
    } else {
      if (keys == undefined || keys == null)
        throw "Error: nestBy() expects column names to deaggregate data";
      vm._config._keys = [keys.toString()];
      console.warning("nestBy() expected name of columns. Argument will be forced to string version .toString()");
    }
    vm._config._labelName = vm._config._keys[vm._config._keys.length - 1]; //label will be last key
    return vm;
  }

  Treemap.format = function(format) {
    var vm = this;
    if (typeof format == 'function' || format instanceof Function)
      vm._config._format = format;
    else
      vm._config._format = d3.format(format);
    return vm;
  }

  Treemap.labels = function(bool) {
    var vm = this;
    vm._config._labels = Boolean(bool);
    return vm;
  };

  Treemap.tip = function(tip) {
    var vm = this;
    vm._config.tip = tip;
    vm._tip.html(vm._config.tip);
    return vm;
  }

  Treemap.scales = function (scales) {
    var vm = this;
    return vm;
  }

  Treemap.axes = function() {
    var vm = this;
    return vm;
  }

  Treemap.domains = function() {
    var vm = this;
    return vm;
  }

  Treemap.isValidStructure = function(datum) {
    var vm = this;
    if ((typeof datum.name === 'string' || datum.name instanceof String) && Array.isArray(datum.children)) {
      var res = true;
      datum.children.forEach(function(child) {
        res = res && vm.isValidStructure(child);
      });
      return res;
    } else if ((typeof datum.name === 'string' || datum.name instanceof String) && Number(datum[vm._config._size]) == datum[vm._config._size]) {
      return true;
    } else {
      return false;
    }
  }

  Treemap.formatNestedData = function(data) {
    var vm = this;
    if (data.key) {
      data.name = data.key;
      delete data.key;
    } else {
      if (!Array.isArray(data.values)) {
        data.name = data[vm._config._labelName];
      }
    }
    if (Array.isArray(data.values)) {
      var children = [];
      data.values.forEach(function(v) {
        children.push(vm.formatNestedData(v))
      });
      data.children = children;
      delete data.values;
    }
    if (!data[vm._config._size] && data.value) {
      data[vm._config._size] = data.value;
    }
    return data;
  }

  function nestKey(nest, key, callback) {
    callback(null, nest.key(function(d) {
      return d[key];
    }))
  }

  Treemap.data = function(data) {
    var vm = this;
    // Validate structure like [{name: '', children: [{},{}]}]
    if (data) {
      if (Array.isArray(data) && data.length > 0) {
        if (!vm.isValidStructure(data[0])) {
          data.forEach(function(d) {
            d[vm._config._size] = +d[vm._config._size];
          });
          try {
            if (!vm._config._keys)
              throw "nestBy() in layer was not configured";
            var nested = d3.nest();
            var queue = d3.queue();
            for (var i = 0; i < vm._config._keys.length; i++)
              queue.defer(nestKey, nested, vm._config._keys[i])
            queue.awaitAll(function(error, nested) {
              var nestedData = nested[0].rollup(function(leaves) {
                return d3.sum(leaves, function(d) {
                  return d[vm._config._size];
                })
              }).entries(data);
              var aux = {};
              aux.key = 'data';
              aux.values = _.cloneDeep(nestedData); // WARN: Lodash dependency
              data = vm.formatNestedData(aux);
              vm._data = data;
            });

          } catch (err) {
            console.error(err);
          }
        }
      } else {
        if (!vm.isValidStructure(data)) {
          try {
            if (!data.key)
              throw "Property 'key' not found";
            if (data[vm._config._size] !== Number(data[vm._config._size]))
              throw "Value used for treemap rect size is not a number";
            data = vm.formatNestedData(data);
            vm._data = data;
          } catch (err) {
            console.error(err);
          }
        }
      }
    }
    return vm;
  }

  Treemap.draw = function() {
    var vm = this;
    vm.chart.svg().call(vm._tip);

    var treemap = d3.treemap()
      .tile(d3.treemapResquarify)
      .size([vm.chart.width, vm.chart.height])
      .round(true)
      .paddingInner(vm._config._padding);

    var root = d3.hierarchy(vm._data)
      .eachBefore(function(d) {
        d.data.id = (d.parent ? d.parent.data.id + "." : "") + d.data.name;
      })
      .sum(function(d) {
        return d[vm._config._size];
      })
      .sort(function(a, b) {
        return b.height - a.height || b.value - a.value;
      });

    treemap(root);

    console.log(root.leaves());

    var cell = vm.chart.svg().selectAll("g")
      .data(root.leaves())
      .enter().append("g")
      .attr("transform", function(d) {
        return "translate(" + d.x0 + "," + d.y0 + ")";
      });

    var rect = cell.append("rect")
      .attr("id", function(d) {
        return d.data.id;
      })
      .attr("width", function(d) {
        return d.x1 - d.x0;
      })
      .attr("height", function(d) {
        return d.y1 - d.y0;
      })
      .attr("fill", function(d) {
        return vm._scales.color(d.data.id);
      });

    cell.append("clipPath")
      .attr("id", function(d) {
        return "clip-" + d.data.id;
      })
      .append("use")
      .attr("xlink:href", function(d) {
        return "#" + d.data.id;
      });

    if (vm._config._labels) {
      var text = cell.append("text")
        .attr("clip-path", function(d) {
          return "url(#clip-" + d.data.id + ")";
        })
      text.append("tspan")
        .attr('class', 'capitalize')
        .attr("x", 8)
        .attr("y", 25)
        .text(function(d) {
          if (d.value > 2) {
            var arr = d.data.id.replace('data.', '').split('.');
            return arr.length > 1 ? arr.slice(arr.length - 2, arr.length).join(' / ') : arr[arr.length - 1].toString();
          } else
            return '';
        });
      text.append("tspan")
        .attr('class', 'capitalize')
        .attr("x", 8)
        .attr("y", 45)
        .text(function(d) {
          return d.value > 2 ? vm._config._format(d.value) : '';
        });
    }

    rect.on('mouseover', function(d) {
        /*if(vm._config.data.mouseover){
          vm._config.data.mouseover.call(vm, d,i);
        }*/
        vm._tip.show(d, d3.select(this).node());
      })
      .on('mouseout', function(d) {
        /*if(vm._config.data.mouseout){
          vm._config.data.mouseout.call(this, d,i);
        }*/
        vm._tip.hide(d, d3.select(this).node());
      })

    return vm;
  }

  Treemap.init(config);
  return Treemap;
}
