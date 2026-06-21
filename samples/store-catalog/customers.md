---
type: BigQuery Table
title: Customers
description: One row per customer, keyed by a stable customer_id.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=customers
tags: [crm, customers]
timestamp: 2026-06-10T08:30:00Z
---

# Schema

| Column | Type | Description |
|--------|------|-------------|
| `customer_id` | STRING | Globally unique customer identifier. |
| `email` | STRING | Primary contact email. |
| `created_at` | TIMESTAMP | Account creation time. |

Referenced by [Orders](/orders.md) and the [Monthly revenue](/monthly-revenue.md) metric.
