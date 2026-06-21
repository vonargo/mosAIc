---
type: BigQuery Table
title: Orders
description: One row per completed order across web and in-store channels.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, orders, revenue]
timestamp: 2026-06-12T10:00:00Z
---

# Schema

| Column | Type | Description |
|--------|------|-------------|
| `order_id` | STRING | Globally unique order identifier. |
| `customer_id` | STRING | Foreign key into [Customers](/customers.md). |
| `channel` | STRING | `web` or `store`. |
| `total_usd` | NUMERIC | Order total in US dollars. |
| `placed_at` | TIMESTAMP | When the order was submitted. |

# Joins

Joined with [Customers](/customers.md) on `customer_id` to attribute revenue.

# Citations

[1] [BigQuery: acme.sales.orders schema](https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders)
