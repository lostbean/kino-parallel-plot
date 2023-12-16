defmodule KinoParallelPlot.MixProject do
  use Mix.Project

  def project do
    [
      app: :kino_parallel_plot,
      version: "0.1.0",
      elixir: "~> 1.15",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  # Run "mix help compile.app" to learn about applications.
  def application do
    [
      extra_applications: [:logger]
    ]
  end

  # Run "mix help deps" to learn about dependencies.
  defp deps do
    [
      {:kino, "~> 0.9.4 or ~> 0.10"},
      {:explorer, "~> 0.7.2 or ~> 0.8"},
      {:rustler, "~> 0.29.0", optional: true},
      {:ex_doc, "~> 0.30.0", only: :dev, runtime: false}
    ]
  end
end
