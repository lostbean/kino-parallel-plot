defmodule KinoParallelPlot do
  # This code is mostly based on: https://github.com/livebook-dev/kino_explorer

  use Kino.JS, assets_path: "lib/assets"

  alias Explorer.DataFrame
  alias Explorer.Series
  require Explorer.DataFrame

  def new(df, label_col, opts \\ []) do
    group_col = Keyword.get(opts, :group_col, label_col)
    cols = Keyword.get(opts, :cols)
    rs = get_records(df, label_col, group_col, cols)
    Kino.JS.new(__MODULE__, rs)
  end

  defp get_records(df, label_col, group_col, cols) do
    lazy = lazy?(df)
    df = if !is_nil(cols), do: DataFrame.select(df, [group_col | [label_col | cols]]), else: df
    total_rows = if !lazy, do: DataFrame.n_rows(df)
    summaries = if total_rows && total_rows > 0, do: summaries(df, [group_col])

    csv =
      df
      |> DataFrame.collect()
      |> DataFrame.dump_csv!()

    %{
      "csv" => csv,
      "summaries" => summaries,
      "total_rows" => total_rows,
      "label_col" => label_col,
      "group_col" => group_col
    }
  end

  defp summaries(df, groups) do
    df_series = DataFrame.to_series(df)
    groups = if groups, do: groups, else: []
    has_groups = length(groups) > 0

    for {column, series} <- df_series,
        summary_type = summary_type(series),
        grouped = (column in groups) |> to_string(),
        nulls = Series.nil_count(series) |> to_string(),
        into: [] do
      if summary_type == :numeric do
        mean = Series.mean(series)
        mean = if is_float(mean), do: Float.round(mean, 2) |> to_string(), else: to_string(mean)
        min = Series.min(series) |> to_string()
        max = Series.max(series) |> to_string()

        summary = %{
          summary_type: summary_type,
          min: min,
          max: max,
          mean: mean,
          nulls: nulls,
          range: [min, max]
        }

        summary = if has_groups, do: Map.put(summary, "grouped", grouped), else: summary
        Map.put(summary, "name", column)
      else
        %{"counts" => top_freq, "values" => top} = most_frequent(series)
        top_freq = top_freq |> List.first() |> to_string()
        top = List.first(top) |> to_string()
        unique = count_unique(series)

        summary = %{
          summary_type: summary_type,
          unique: unique,
          top: top,
          top_freq: top_freq,
          nulls: nulls
        }

        summary = if has_groups, do: Map.put(summary, "grouped", grouped), else: summary
        Map.put(summary, "name", column)
      end
    end
  end

  defp most_frequent(data) do
    data
    |> Series.frequencies()
    |> DataFrame.head(2)
    |> DataFrame.filter(Series.is_not_nil(values))
    |> DataFrame.head(1)
    |> DataFrame.to_columns()
  end

  defp summary_type(data) do
    if numeric_type?(Series.dtype(data)), do: :numeric, else: :categorical
  end

  defp count_unique(data) do
    data |> Series.distinct() |> Series.count() |> to_string()
  end

  defp numeric_type?(:integer), do: true
  defp numeric_type?({:f, _}), do: true
  defp numeric_type?(_), do: false

  defp lazy?(%DataFrame{data: %struct{}}), do: struct.lazy() == struct
end
