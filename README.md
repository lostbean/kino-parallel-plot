Kino Parallel Plot:
------------------

## Usage on [livebooks](https://livebook.dev):

Add this repository as an dependency: 
```elixir
Mix.install([
  :kino,
  {:explorer, "~> 0.7.2"},
  {:kino_parallel_plot, git: "https://github.com/lostbean/kino-parallel-plot.git"}
])
```

And try a simple example:
```elixir
df = Explorer.Datasets.iris()
KinoParallelPlot.new(%{df: df, groups: []})
```


