const API =
  "https://pip.worldbank.org/pip/v1/pip";

let povertyChart = null;

function $(id) {
  return document.getElementById(id);
}

function showError(message) {
  const box = $("error");

  if (box) {
    box.textContent = message;
    box.classList.remove("hidden");
  }

  console.error(message);
}

function clearError() {
  const box = $("error");

  if (box) {
    box.classList.add("hidden");
  }
}

function getValue(row, names) {
  for (const name of names) {
    if (
      row[name] !== undefined &&
      row[name] !== null &&
      row[name] !== ""
    ) {
      return row[name];
    }
  }

  return null;
}

async function getPovertyData(country) {

  clearError();

  const url =
    `${API}?country_code=${encodeURIComponent(country)}`;

  console.log("Requesting:", url);

  const response =
    await fetch(url, {
      cache: "no-store"
    });

  if (!response.ok) {
    throw new Error(
      `World Bank API returned HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  console.log("World Bank response:", data);

  let rows = [];

  if (Array.isArray(data)) {
    rows = data;
  } else if (Array.isArray(data.data)) {
    rows = data.data;
  } else if (Array.isArray(data.results)) {
    rows = data.results;
  }

  if (!rows.length) {
    throw new Error(
      "The World Bank returned no poverty observations."
    );
  }

  return rows;
}

function normalize(rows) {

  return rows
    .map(row => {

      const year =
        getValue(row, [
          "reporting_year",
          "reportingYear",
          "year"
        ]);

      const rate =
        getValue(row, [
          "headcount",
          "headcount_ratio",
          "headcountRatio",
          "poverty_rate",
          "povertyRate"
        ]);

      return {
        year: Number(year),
        rate: Number(rate)
      };

    })
    .filter(row =>
      Number.isFinite(row.year) &&
      Number.isFinite(row.rate)
    )
    .sort((a, b) =>
      a.year - b.year
    );
}

function display(rows) {

  if (!rows.length) {
    throw new Error(
      "No usable poverty-rate values were found."
    );
  }

  const latest =
    rows[rows.length - 1];

  const previous =
    rows.length > 1
      ? rows[rows.length - 2]
      : null;

  $("rate").textContent =
    `${latest.rate.toFixed(2)}%`;

  $("rateYear").textContent =
    `Latest available observation: ${latest.year}`;

  if (previous) {

    const change =
      latest.rate - previous.rate;

    const percent =
      previous.rate !== 0
        ? (change / previous.rate) * 100
        : null;

    $("change").textContent =
      `${change >= 0 ? "+" : ""}` +
      `${change.toFixed(2)} percentage points`;

    $("changeType").textContent =
      percent === null
        ? "Relative change unavailable"
        :
        `${percent >= 0 ? "+" : ""}` +
        `${percent.toFixed(2)}% since ${previous.year}`;

    if (change > 0.1) {
      $("status").textContent =
        "Increasing";
    } else if (change < -0.1) {
      $("status").textContent =
        "Decreasing";
    } else {
      $("status").textContent =
        "Stable";
    }

    $("statusDetail").textContent =
      `Compared with ${previous.year}`;

  } else {

    $("change").textContent =
      "Unavailable";

    $("changeType").textContent =
      "Only one observation";

    $("status").textContent =
      "Unavailable";

    $("statusDetail").textContent =
      "More observations required";
  }

  drawChart(rows);
}

function drawChart(rows) {

  const canvas =
    $("povertyChart");

  if (!canvas) return;

  if (povertyChart) {
    povertyChart.destroy();
  }

  povertyChart =
    new Chart(canvas, {

      type: "line",

      data: {

        labels:
          rows.map(row =>
            row.year
          ),

        datasets: [{

          label:
            "Poverty rate (%)",

          data:
            rows.map(row =>
              row.rate
            ),

          tension: 0.25,

          borderWidth: 2,

          pointRadius: 3

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        scales: {

          y: {

            beginAtZero: true,

            title: {

              display: true,

              text:
                "Population (%)"

            }

          }

        }

      }

    });
}

async function loadCountry(country) {

  try {

    $("rate").textContent =
      "Loading...";

    $("poorPop").textContent =
      "—";

    $("change").textContent =
      "Loading...";

    $("status").textContent =
      "Loading...";

    const rows =
      await getPovertyData(country);

    const cleanRows =
      normalize(rows);

    display(cleanRows);

  } catch (error) {

    console.error(error);

    $("rate").textContent =
      "Unavailable";

    $("poorPop").textContent =
      "Unavailable";

    $("change").textContent =
      "Unavailable";

    $("status").textContent =
      "Unavailable";

    showError(
      "World Bank data could not be loaded: " +
      error.message
    );
  }
}

if ($("country")) {

  $("country").addEventListener(
    "change",
    event => {
      loadCountry(event.target.value);
    }
  );
}

if ($("refresh")) {

  $("refresh").addEventListener(
    "click",
    () => {
      loadCountry(
        $("country").value
      );
    }
  );
}

/*
  Start with India.
*/
loadCountry("IND");
