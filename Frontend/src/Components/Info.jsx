import React from "react";
import "./Info.css";

export default function Info() {
  return (
    <div className="info-container">
      <div className="info-content">
        <h2 className="info-title">Overview</h2>
        <p className="info-text">
          Organizations modernizing their data platforms face a massive
          bottleneck when moving legacy Oracle Data Integrator (ODI) code to the
          Databricks Lakehouse. Rewriting complex ETL mappings by hand is highly
          prone to human error and consumes valuable engineering hours.
        </p>
        <p className="info-text">
          The <strong>Flytics SQL~Databricks Code Migration Tool</strong>{" "}
          automates this pipeline. By simply uploading a raw <code>.txt</code>{" "}
          file containing your legacy ODI SQL extracts, our engine instantly
          translates the logic and wraps it into a fully structured,
          Databricks-compatible Jupyter Notebook (<code>.ipynb</code>), complete
          with proper JSON metadata and cell formatting.
        </p>

        <div className="info-grid">
          <div className="info-card">
            <h3 className="info-card-title">Migration Challenges</h3>
            <ul className="info-list">
              <li>
                <strong>Manual Notebook Creation:</strong> Copying SQL into
                individual notebook cells and manually structuring JSON formats
                is extremely tedious.
              </li>
              <li>
                <strong>Syntax Translation:</strong> Converting Oracle-specific
                SQL dialects into optimized Spark SQL requires deep technical
                expertise.
              </li>
              <li>
                <strong>Formatting Errors:</strong> Missing or malformed
                notebook metadata (nbformat) can completely corrupt Databricks
                workspace imports.
              </li>
              <li>
                <strong>High Developer Overhead:</strong> Migrating hundreds of
                ODI tasks manually ties up data engineers for months.
              </li>
            </ul>
          </div>

          <div className="info-card">
            <h3 className="info-card-title">Flytics Results</h3>
            <ul className="info-list">
              <li>
                <strong>Instant Generation:</strong> Converts raw{" "}
                <code>.txt</code> SQL scripts into perfectly formatted{" "}
                <code>.ipynb</code> structures in seconds.
              </li>
              <li>
                <strong>Ready-to-Deploy Code:</strong> The downloaded notebooks
                can be directly imported into your Databricks environment
                without structural tweaks.
              </li>
              <li>
                <strong>High Precision:</strong> Eliminates syntax typos and
                metadata errors through automated, consistent conversion
                mapping.
              </li>
              <li>
                <strong>Accelerated Delivery:</strong> Empowers your data
                engineering team to focus on architecture and optimization
                rather than copy-pasting code.
              </li>
            </ul>
          </div>
        </div>

        <h2 className="info-title">Summary</h2>
        <p className="info-text">
          The Flytics migration interface bridges the gap between legacy ODI
          text exports and the modern Databricks ecosystem. By fully automating
          the <code>.txt</code> to <code>.ipynb</code> pipeline in a single
          click, data teams can effortlessly ignite their new Spark workloads
          without missing a beat.
        </p>
      </div>
    </div>
  );
}
