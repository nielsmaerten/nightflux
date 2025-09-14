This file is a structured diabetes data export in YAML.

### Structure

* **\$schema**: URL for validation schema.
* **meta**: schema version and generation timestamp.
* **profiles**: predefined insulin profiles. Each has:

  * `id`, `name`, `tz` (timezone).
  * `blocks`: basal rates at times of day, with `m` (minutes since midnight) and `iu_h` (insulin units per hour).
* **days**: daily logs. Each day contains:

  * `date`: timestamp + timezone.
  * `activeProfiles`: which basal profile was active, with percentage multipliers and start times.
  * **cgm**: continuous glucose monitor readings (`t` = timestamp, `mgDl` = glucose value).
  * **carbs**: logged carbohydrate intakes (`g` grams, with `t` timestamp).
  * **bolus**: insulin boluses (`iu` insulin units, with `t` timestamp).
  * **basal**: basal delivery events. Each has:

    * `t`: start timestamp.
    * `iu_sum`: total insulin given in the period.
    * `iu_h`: rate in units/hour.
    * `d`: duration in seconds.
    * `type`: `"baseline"`, `"temp-absolute"`, or `"combo-relative"` (indicating type of basal adjustment).

### Purpose

This dataset is meant for retrospective diabetes analysis:

* Track glucose trends.
* Correlate meals, insulin doses, and basal adjustments.
* Support reporting or visualization tools for therapy optimization.
