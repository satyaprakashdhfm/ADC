Here is the complete, comprehensive documentation for the **Shadowfax Unified API for Forward Integrations** compiled into a highly detailed, clean, and well-structured manual.

You can review all endpoints, lifecycles, and payload specifications right here, or print this directly into a tidy PDF via your browser's Print menu (**Ctrl + P** or **Cmd + P**).

---

# Shadowfax Unified API Documentation (Forward Integrations)

**Environments & Gateways:**

* **Staging Base URL:** `[https://dale.staging.shadowfax.in/api](https://dale.staging.shadowfax.in/api)`

* **Production Base URL:** `[https://dale.shadowfax.in/api](https://dale.shadowfax.in/api)`


---

## 1. Architecture Overview & Core Glossary

The Unified API Collection provides a singular infrastructure to integrate with Shadowfax's Last Mile Customer Delivery Platform, supporting both **Marketplace Seller** and **Warehouse** models of operations. These APIs manage the end-to-end order lifecycle starting from initial Pincode serviceability up to status tracking, delivery, or reverse return runs.

### Core Facility Concepts

* **DC (Distribution Center):** Large core logistics facilities typically located in the outskirts of a city where both intercity and intracity shipments are heavily processed.


* **Hub:** Small urban facilities scattered across a city from which last-mile delivery riders deploy and first-mile seller pickups are consolidated.



### Shipment Location States

* **Origin Hub:** The very first Shadowfax facility a package physically reaches directly from a seller or customer.


* **Origin DC:** The first major distribution center a packet is transferred to from a client warehouse or origin hub for processing.


* **Destination DC:** The final distribution center a packet passes through before traveling to the local destination hub or client warehouse.


* **Destination Hub:** The final last-mile facility where a packet rests immediately before being handed to a rider for delivery.


* **Via DC:** Intermediate transit DCs where shipments pass through. Manifest transport bags are **not** opened at these nodes; they are scanned and passed along.



### Operational Typology

* **Forward Operations:** Orders originating directly from a client warehouse or localized merchant seller intended for delivery to the end customer.


* **Reverse Operations:** Return orders originating from the customer's side, or forward shipments that could not be delivered and must return to the original merchant or warehouse.



### Miscellaneous Tracking Identifiers

* **AWB:** Air Waybill number—a unique tracking identification number assigned to every individual item or packet.


* **LOR:** Letter of Receipt—an official acknowledgment document for validating the handoff or delivery of packets.


* **POD (Proof of Delivery):** Documented digital or physical verification matching the pickup or successful receipt of cargo.



---

## 2. Global Integration Configuration

### Authentication

Shadowfax relies strictly on HTTP Token Authentication. Valid staging and production credentials will be systematically provisions to you by your Shadowfax Account Manager via email. Your mandatory header formatting must conform to this pattern:

```http
Authorization: Token <your_assigned_token_key>
Content-Type: application/json

```

> **Note:** The `Authorization` header content must string-prefix verbatim with the word `Token` followed by a space and your security string.
> 
> 

### Request Data Standardization

* The architecture leverages standard HTTP Rest design patterns (`GET`, `POST`, `DELETE`).


* All data payloads pushed via `POST` methods must encode as standard `application/json`.


* **Date Formats:** Formatted exactly as `(YYYY:MM:DD)`.


* **DateTime Formats:** Formatted exactly as `(YYYY:MM:DD HH:MM:SS)`.



### Standard HTTP Response Status Codes

* `200` — **OK:** Request processed flawlessly.


* `400` — **Bad Request:** Missing arguments, malformed payloads, or unmet parameters.


* `401` — **Unauthorized:** The token provided is missing or incorrect.


* `404` — **Not Found:** The targeted endpoint or asset identifier is invalid.


* `500` — **Internal Server Error:** Internal pipeline error.


* `503` — **Service Unavailable:** Temporary system maintenance; retry later.



---

## 3. Order Lifecycle State Machines

When calling order tracking APIs, the state of any package is transmitted inside the `status_id` response variable. The following status code tables chart the lifecycle maps for each logistics model:

### Marketplace Operational Lifecycle Matrix

This matrix governs flows where individual independent merchants handle fulfillment from their custom point locations:

| status_id | Display Status Name | Standard Remarks Text | Functional Status Context Description |
| --- | --- | --- | --- |
| `new` | New | Item New at `<SFX Facility>` | A fresh shipment file has been safely registered in the system.

 |
| `assigned_for_seller_pickup` | Assigned For Pickup | Item Assigned For Customer Pickup at `<SFX Facility>` | System has assigned a pickup rider to collect the package from the seller.

 |
| `ofp` | Out For Pickup | Item Out For Pickup at `<SFX Facility>` | Rider is actively traveling to the seller point to collect cargo.

 |
| `picked` | Picked | Picked | Package was collected successfully from the merchant.

 |
| `recd_at_rev_hub` | Received At Reverse Hub | Received at hub Successfully | Item has arrived back safely and checked into the pickup origin hub.

 |
| `item_manifested` | Item added to Bag | Item added to bag at `<SFX facility>` | Packet has been assigned and sealed into a bulk transport line-haul bag.

 |
| `bag_in_transit` | Bag In Transit | Bag in transit from `<SFX Facility>` | The sealed master transport bag is moving on a vehicle between DCs.

 |
| `bag_received_at_via` | Bag Received at Via | Bag received at `<SFX Facility>` | The master bag has touched down sequentially at an intermediate routing DC.

 |
| `bag_received` | Bag Received | Bag received at `<SFX Facility>` | The container has been checked into the target terminal destination hub/DC.

 |
| `recd_at_fwd_dc` | Received At DC | Item Received at dc at `<SFX Facility>` | The package has been unpacked from its bag inside the destination city DC.

 |
| `recd_at_fwd_hub` | Received At Forward Hub | Item Received at hub at `<SFX Facility>` | The individual packet arrives at the localized last-mile delivery hub.

 |
| `assigned_for_delivery` | Assigned for Customer Delivery | Item Assigned at `<SFX Facility>` | Parcel assigned to a delivery executive at the target local hub.

 |
| `ofd` | Out For Delivery | Item OFD at `<SFX Facility>` | Delivery executive is actively attempting delivery to the customer.

 |
| `delivered` | Delivered | Item Delivered at `<SFX Facility>` | Final handoff successfully logged to the end consumer.

 |
| `cid` | Cid | Customer wants delivery on another date | Customer Initiated Delay: The customer asked to reschedule delivery.

 |
| `seller_initiated_delay` | Cid | Seller Initiated Delay | The merchant requested collection execution on a later date.

 |
| `seller_not_contactable` | Not Contactable | Seller not reachable | The courier cannot contact the merchant to pick up the order.

 |
| `nc` | Not Contactable | See Appendix | Customer cannot be reached via call or verification during delivery.

 |
| `pickup_not_attempted` | Not Attempted | Not able to attempt | The fleet could not attempt the merchant pickup due to internal limits.

 |
| `na` | Not attempted | See Appendix | Delivery attempt missed due to operational field blocks.

 |
| `cancelled_by_seller` | Cancelled By Seller | Item cancelled by seller at `<SFX Facility>` | The vendor submitted a hard cancellation request for the order.

 |
| `cancelled_by_customer` | Cancelled | See Appendix | The buyer cancelled the shipment.

 |
| `rts` | Return to Seller initiated | Item Return To Seller at `<SFX Facility>` | Reverse logistical tracking routing is forced back toward the seller.

 |
| `rts_in_process` | RTS In Progress | Item RTS In Progress at `<SFX Facility>` | Reverse journey processing through middle nodes is actively under way.

 |
| `rts_ofd` | Out for Delivery for RTS | Item out for delivery to seller at `<SFX Facility>` | Delivery executive is out trying to return the item back to the merchant.

 |
| `rts_nd` | Undelivered | Item Return to Seller Not Delivered at `<SFX Facility>` | Return attempt to the vendor failed.

 |
| `rts_d` | Returned To Client | Item Return To Seller Delivered at `<SFX Facility>` | Package securely handed back to origin vendor stock.

 |
| `lost` | Lost | Item Lost at `<SFX Facility>` | Item auditing explicitly marks the packet missing in the network.

 |
| `on_hold` | On Hold | See Appendix | Order paused due to exceptions like incorrect contact info.

 |
| `pickup_on_hold` | Pick up On Hold | See Appendix | Pickup pending investigation due to validation exceptions.

 |
| `reopen_ndr` | Require Delivery - NDR | Require Delivery As Per NDR Instructions | System triggers re-attempt based on customer response.

 |
| `pincode_updated` | Pincode Updated | Item destination pincode updated at `<SFX Facility>` | Destination addresses routing parameters were formally modified.

 |
| `item_misrouted` | Item Misrouted | Item misrouted at `<SFX Facility>` | Package arrived at an incorrect processing facility.

 |

### Warehouse Operational Lifecycle Matrix

This matrix governs flows starting directly inside centralized client fulfillment warehouses:

| status_id | Display Status Name | Standard Remarks Text | Functional Status Context Description |
| --- | --- | --- | --- |
| `new` | New | Item New at `<SFX Facility>` | Warehouse delivery docket registered in processing database.

 |
| `received_from_client_warehouse` | Received from Client Warehouse | Item Received from Client Warehouse at `<SFX Facility>` | Package collection confirmed at the central client warehouse floor.

 |
| `item_manifested` | Item added to Bag | Item added to bag at `<SFX facility>` | Parcel bundled inside structural transit line bags.

 |
| `bag_in_transit` | Bag In Transit | Bag in transit from `<SFX Facility>` | Consolidated container moving along major trade channels.

 |
| `bag_received_at_via` | Bag Received at Via | Bag received at `<SFX Facility>` | Sack touched down at a gateway sorting structure.

 |
| `bag_received` | Bag Received | Bag received at `<SFX Facility>` | Master manifest bag safely reaches the target urban station node.

 |
| `recd_at_fwd_dc` | Received At DC | Item Received at dc at `<SFX Facility>` | Item verified out of the container at the target city distribution center.

 |
| `recd_at_fwd_hub` | Received At Forward Hub | Item Received at hub at `<SFX Facility>` | Item moved to the final local distribution delivery point.

 |
| `assigned_for_delivery` | Assigned for Customer Delivery | Item Assigned at `<SFX Facility>` | Delivery task assigned to a last-mile delivery executive.

 |
| `ofd` | Out For Delivery | Item OFD at `<SFX Facility>` | Rider is on the road attempting to deliver to the client.

 |
| `delivered` | Delivered | Item Delivered at `<SFX Facility>` | Package safely accepted by end user.

 |
| `cid` | Cid | Customer wants delivery on another date | Delivery windows deferred by explicit customer request.

 |
| `on_hold` | On Hold | See Appendix | Package paused due to structural delivery errors.

 |
| `reopen_ndr` | Require Delivery - NDR | Require Delivery As Per NDR Instructions | System triggers a delivery re-attempt based on feedback loops.

 |
| `nc` | Not Contactable | See Appendix | Delivery attempt missed because the client could not be reached.

 |
| `na` | Not attempted | See Appendix | Delivery process paused due to field anomalies.

 |
| `cancelled_by_customer` | Cancelled | See Appendix | hard operational cancellation triggered.

 |
| `rto` | Return to origin initiated | Item Return To Origin at `<SFX Facility>` | Final delivery failed; package marked for reverse tracking return.

 |
| `rto_in_process` | In RTO/RTS Process | Item RTO In Progress at `<SFX Facility>` | Reverse shipping leg actively tracked back through middle facilities.

 |
| `rto_d` | Returned to Client | Item Return To Origin Delivered at `<SFX Facility>` | Item returns back to the parent warehouse.

 |
| `rto_nd` | Undelivered | Item Return To Origin Not Delivered at `<SFX Facility>` | Return processing run faced collection resistance.

 |
| `lost` | Lost | Item Lost at `<SFX Facility>` | Parcel audited out of system tracking loops.

 |
| `item_misrouted` | Item Misrouted | Item misrouted at `<SFX Facility>` | Misrouting detected; automated correction processing applied.

 |

---

## 4. API Endpoints Specification

### Group: Serviceability

#### Unified Pincode Serviceability Verification [`GET /v1/clients/serviceability/`]

Determine structural delivery or pickup access for specific geographic targets. If parameters matching pages or records are withheld, responses default automatically to 25 items.

* **Query Parameters:**
* `service` (Required | String): Options include: `seller_pickup`, `customer_delivery`, `customer_pickup`, `seller_delivery`, `warehouse_pickup`, `warehouse_return`.


* `pincodes` (Required | Comma Separated Integers): Targeted zones, e.g., `560016,560017`.


* `page` (Optional | Integer): Specific tracking page indicator.


* `count` (Optional | Integer): Absolute maximum item block lengths returns per query view.





##### Request Payload Example:

```text
GET https://dale.staging.shadowfax.in/api/v1/clients/serviceability/?service=customer_delivery&page=1&count=10&pincodes=560016,560017

```

##### Response Definitions Matrix:

* **Success (200 OK — application/json):**
```json
[
    { "code": 560017, "services": ["Regular", "Surface"] },
    { "code": 560016, "services": ["Regular"] }
]

```


* **Authentication Exception (401 Unauthorized):**
```json
{
    "status": "FAILED",
    "errorCode": "Authentication credentials not provided",
    "message": "Authentication credentials not provided"
}

```


* **Request Fault (400 Bad Request):**
```json
{ "message": "Invalid Request" }

```



---

### Group: AWB Generation

#### Pre-allocate AWB Trackers Array [`POST /v3/clients/generate_marketplace_awb/`]

Automated generation pipeline supplying fresh, unused AWB integers before loading shipping details. Single invocation ceilings are capped at **100,000 requests**.

##### Request Payload Example:

```json
{ 
    "count" : 10
}

```

##### Response Definitions Matrix:

* **Success (200 OK):**
```json
{
    "message": "Success",
    "awb_numbers": [
        "SF10000001san",
        "SF10000002san",
        "SF10000003san"
    ]
}

```


* **Count Bounds Breach (400 Bad Request):**
```json
{ "message": "Max limit on count is 100000. Please input a lower integer" }

```



---

### Group: Order Creation

#### Order Insertion Engine [`POST /v3/clients/orders/`]

Commits fresh packages directly into active fulfillment lines. Set `order_type` to `"marketplace"` or `"warehouse"` to select the operational mode. Staging sandbox validation tests should pass these serviceable test pincodes: `110009`, `560077`, `560007`.

##### Parameters:

* `format` (Optional | String): Choose format pattern (`json` or `xml`). Default value is `json`.



##### Request Payload Example:

```json
{
  "order_type": "marketplace",
  "order_details": {
    "client_order_id": "0123",
    "actual_weight": 100,
    "volumetric_weight": 100,
    "product_value": 515,
    "payment_mode": "Prepaid",
    "cod_amount": "0",
    "promised_delivery_date": "2018-01-09T00:00:00.000Z",
    "total_amount": 5555,
    "eway_bill":"7452128",
    "gstin_number" : "74185263",
    "order_service":"regular"
  },
  "customer_details": {
    "name": "Deepak",
    "contact": "9999999999",
    "address_line_1": "Flat 38 Loknayak Aptt Sector 9 Rohini",
    "city": "New Delhi",
    "state": "Delhi",
    "pincode": 110001
  },
  "pickup_details": {
    "name": "HSR Telecom",
    "contact": "9999999999",
    "address_line_1": "8th main 5th cross",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": 560007,
    "unique_code" : "warehousecode01"
  },
  "rts_details": {
    "name": "Deepak",
    "contact": "9999999999",
    "address_line_1": "sec-24 poc-25 Hno-76",
    "city": "Ludhiana",
    "state": "Punjab",
    "pincode": 110009,
    "unique_code" : "warehousecode01"
  },
  "product_details": [
    {
      "sku_id": "MAC789",
      "sku_name": "macBook Air",
      "price": 4500,
      "category": "cosmic"
    }
  ]
}

```

##### Attribute Mapping Constraints:

* `order_details.client_order_id` (Required | String): Character maximum bound: 100.


* `order_details.payment_mode` (Required | String): Must evaluate exactly to `COD` or `Prepaid`.


* `order_details.volumetric_weight` (Optional | Number): Evaluated via formula standard: $\frac{L \times B \times H}{5000}$.


* `order_details.eway_bill` (Optional | String): Max 12 alphanumeric characters.


* `customer_details.contact` (Required | String): Character length range bounds: 10 to 13 digits.



##### Response Architecture:

* **Success Array Return (200 OK):**
```json
{
    "message": "Success",
    "errors": null,
    "data": {
        "id": 2199782,
        "client_order_id": "3399845736",
        "awb_number": "SF401022456TST",
        "status": "new"
    }
}

```


* **Business Failure Responses (200 Error Object payloads):**
* *Collision Exceptions:* `{"message": "Failure", "errors": "Order for COID... already created with AWB..."}`

* *SLA High Value Rule:* `{"message": "Failure", "errors": "GSTIN Number is mandatory for product value more than 50000"}`

* *Unserviceable Area Fault:* `{"message": "Failure", "errors": "Invalid Pickup Pincode. Pickup pincode 128888 is not serviceable"}`



* **Financial Enforcement Blocks (400 Bad Request):**
```json
{ "message": "Cannot place an Order: Please clear your pending invoices to start placing order again" }

```



---

### Group: Order Details & Tracking

#### Single Item Tracking Ledger V4 [`GET /v4/clients/orders/{awb_number}/track/`]

Returns real-time locations and the full sequence of intermediate transport events (including bag manifest transit operations).

##### Request Payload Example:

```text
GET https://dale.shadowfax.in/api/v4/clients/orders/SF222344412TST/track/

```

##### Response Payload Schema (200 OK):

```json
{
    "message": "Success",
    "order_details": {
        "client_order_id": "11002",
        "awb_number": "SF222344412TST",
        "status": "rts_nd",
        "customer_track_url": "https://exp.shadowfax.in/JdDYM6"
    },
    "tracking_details": [
        {
            "created": "2022-02-28T08:58:57Z",
            "location": "SFX TestHub",
            "status_id": "new",
            "status": "New",
            "remarks": "Item New at SFX TestHub"
        },
        {
            "created": "2022-02-28T09:00:59Z",
            "location": "SFX TestHub",
            "status_id": "bag_in_transit",
            "status": "Bag In Transit",
            "remarks": "Bag in transit from SFX TestHub"
        }
    ]
}

```

#### Multiple Bulk Tracking V4 [`POST /v4/clients/bulk_track/`]

Enables high-velocity, real-time tracking across multiple arrays in a single network transaction. Single query limits accept up to **50 individual AWBs**.

##### Request Payload Example:

```json
{
    "awb_numbers": [
        "SF1360594400TES",
        "SF1360594301TES"
    ]
}

```

##### Bulk Cap Breach Failure (400 Bad Request):

```json
{ "message": "Number of AWBs exceeded. Max count allowed is 50" }

```

---

### Group: Update Order Details

#### Live Order Routing Modification Pipeline [`POST /v3/clients/order_update/`]

Modify customer details, pickup details, package metrics, and status parameters during active transit windows.

##### System State Validation Rules:

* **Force State Transitions:** Overriding states to `rts`, `rto`, or `reopen_ndr` can only be completed if the shipment's current state is explicitly set to `on_hold` or `cancelled_by_customer`.


* **Pincode Alterations:** Address pincode changes are strictly restricted to a maximum of **2 mutations per order lifecycle** and apply only to intra-city rerouting. Intercity re-routing requests return a hard failure payload. Pincodes cannot be edited once an item is marked `delivered`.


* **Weight Recalculations:** Actual or volumetric dimensional parameters can be updated exactly **once**, strictly while the item's tracking status remains `new`.


* **Dynamic Deadlines:** Delivery context details can be edited anytime before the package goes Out For Delivery (`ofd`). Pickup context values remain editable up until the parcel is assigned for seller pickup (`assigned_for_seller_pickup`).



##### Request Payload Example:

```json
{
    "awb_number": "SF47850936san",
    "delivery_details": {
        "contact": "9999999999",
        "customer_address": "#253, 2nd cross hebbal",
        "pincode": 560008
    },
    "order_details": {
        "cod_amount": 0,
        "actual_weight": "539.127",
        "volumetric_weight": "1498.314"
    },
    "status_update": {
        "status": null
    }
}

```

---

### Group: Order Cancellation

#### Cancellation Interception Engine [`POST /v3/clients/orders/cancel/`]

Triggers an immediate cancellation request via unique client references or tracking AWBs.

##### Processing Lifecycles:

* **Instant Finalization (Response 200 Code):** If the shipment is safely sitting inside stagnant storage phases, the order updates to "cancelled" immediately.


* **Queued Interception Execution (Response 304 Code):** If the item is in active motion (`ofp`, `recd_at_rev_hub`, `ofd`, `bag_in_transit`, `bag_received_at_via`), the operation queues up. Interception triggers automatically when the parcel is scanned at the next check-in station.


* **Hard Termination Rejections:** Attempting to cancel an order that is already `delivered` drops a `400 Bad Request` with the message: `Order cannot be cancelled. Invalid state.`.



##### Request Payload Example:

```json
{ 
    "request_id": "SF10000002NRN",
    "cancel_remarks": "Request cancelled by customer"
}

```

---

### Group: Escalation API

#### Real-Time Support Ingestion Gateway [`POST /v1/clients/support/issue/`]

Allows your internal support infrastructure to log tracking exceptions and open real-time investigator tickets inside the Shadowfax platform.

##### Issue Category Coding Map:

| Code Integer | Target Issue Category Name | Structural Integration Validations | Leg Mapping Scope |
| --- | --- | --- | --- |
| **1** | `Delayed Delivery` | Can only be processed after item collection is confirmed, past the promised delivery timeline.

 | Forward Operations

 |
| **2** | `Expedite Pickup - Customer` | Valid only while customer return collection remains unfulfilled.

 | Reverse Operations

 |
| **3** | `Expedite Pickup - Seller` | Valid only while merchant pickup attempts remain incomplete.

 | Forward Operations

 |
| **4** | `Status Mismatch` | Discrepancy logged between actual parcel events and platform records.

 | Universal

 |
| **5** | `Delivery Dispute` | Can only be raised after an item has been marked as completely delivered.

 | Forward Operations

 |

##### Request Payload Example:

```json
{
    "awb_number" : "SF00000000TC",
    "issue_category" : 1
}

```

---

### Group: Get POD Details

#### Proof of Delivery Extraction Gateway [`POST /v1/clients/pod_details/`]

Extract delivery verification data, recipient metadata, and Amazon S3 hosting links for delivery signature sheets. Single requests can batch up to **100 tracking IDs**. Target shipments must be in the `delivered` or `rts_d` status.

##### Request Payload Example:

```json
{
    "awb_numbers": [
        "SF17102220TE",
        "SF16330181TE"
    ]
}

```

##### Response Payload Schema (200 OK):

```json
{
    "message": "Success",
    "pod_details": {
        "SF16330181TE": {
            "recipient": "CUSTOMER",
            "recipient_signature": "['https://s3-us-west-2.amazonaws.com/sfxdocs/seller/delivery_report/report_1992.pdf']",
            "recipient_name": "Deepak Rastogi"
        }
    }
}

```

---

### Group: Generate QR Code

#### B2C Invoice Dynamic UPI QR Generation [`POST /api/v2/clients/qr_code/generate/`]

Generates dynamic compliance QR strings for cash-on-delivery (COD) packages, aligning with Government of India consumer electronic invoicing directives. Returns an authentic base UPI payment path string that can be printed on shipment invoices or shipping labels.

##### Request Payload Example:

```json
{
    "awb_number": "SF29534985888TER",
    "gstin": "36AAVCS6697K1Z4",
    "invoice_number": "ADSf",
    "invoice_date": "2021-03-25 12:20:16",
    "amount": 1.00,
    "taxableValue": 12.00,
    "gstPercentage": 12.00,
    "gst": 23.00,
    "cgst": 0.00,
    "sgst": 23.00,
    "igst": 23.00,
    "cess": 0.00
}

```

##### System Processing Constraints:

* QR strings generate exclusively for Cash on Delivery (`COD`) forward orders. Prepaid order requests will fail validation.


* The `amount` field parameter must match the order's registered `cod_amount` exactly.



##### Response Payload Schema (200 OK):

```json
{
    "message": "success",
    "payment_mode": "UPI/QR",
    "qr_details": {
        "qr_code_string": "upi://pay?pa=BHARATPE30029095568@yesbankltd&pn=Shadowfax...&am=1.0&awb_number=SF29534985888TER",
        "transaction_id": "BHARATPE30029095568"
    }
}

```

---

## 5. Webhook Push Callback System

To avoid rate-limiting from continuous tracking queries, configure the automated Webhook Event Engine inside your client dashboard. The platform pushes real-time JSON payloads whenever an order status updates.

### Custom Header Parameters

Webhooks can be configured with specific request headers through the client portal, such as adding account identifiers or security signatures:

```http
Content-Type: application/json
Authorization: d5eecf30ae6eb8d158dc54c77178ab9
account_name: SF_ACC_STAGING

```

### Webhook Event Payload Schema

```json
{
    "awb_number": "SF610198449AAA",
    "order_id": "FL20230517311447364",
    "event_timestamp": "2023-05-18 16:22:13",
    "current_location": "CHN_Ambattur_EXP",
    "comments": "Item Delivered at CHN_Ambattur_EXP",
    "event": "delivered",
    "status": "Delivered",
    "otp_verified": "Y",
    "rider_name": "Rider Name",
    "rider_contact": "9876543210",
    "client_id": 2245,
    "recipient_info": {
        "recipient": "Customer",
        "recipient_name": "Chittaranjan",
        "recipient_contact": "20369854715",
        "recipient_signature": []
    },
    "type": "FWD"
}

```

### Optional Payload Attributes (Available on Request):

* `shipmenttype`: Identifies the tracking direction lane (`F` matches Forward leg, `R` matches Reverse tracking leg).


* `payMode`: Payment format identifier (`C` for COD operations, `P` for Prepaid transactions).


* `attempt_number`: Explicit delivery re-attempt index integer count.



---

## 6. Appendix: Reason Code Glossaries

### On-Hold Remarks (Marketplace Forward)

* Incorrect/incomplete contact info


* Pincode/address mismatch


* Customer wants open delivery


* Customer shifted from given address


* Non Serviceable Area


* Customer wants delivery on another address


* High Volume Shipment


* Three successful attempts done


* Customer wants delivery beyond cut-off date


* Payment Issue


* High Ageing


* COVID Restricted Area


* Same City Pincode Update


* InterCity Shipment


* Address is Junk


* RTO Pending - Max attempts exhausted


* RTO Pending - OTP validated cancellation


* RTO Pending - OTP not validated cancellation


* RTO Pending - Cancelled by customer through webapp


* RTO Pending - Awaiting runsheet closure



### Pickup On-Hold Remarks (Marketplace)

* Customer want pick-up from Non-Serviceable area


* Pincode Address Mismatch


* Incorrect contact number


* Address issue


* Customer wants replacement/refund first


* Incomplete information received from client


* Mandatory check not available


* Pickup already done by other DSP


* Shipment is not picked


* Successful 3 attempts done


* Large Shipment


* Customer wants pickup beyond cut off time


* Customer changed his/her mind


* Doorstep QC Brandbox not available


* DOORSTEP_QC_PRICE_TAG_MISSING


* DOORSTEP_QC_PRODUCT_DAMAGE


* DOORSTEP_QC_PRODUCT_MISMATCH


* DOORSTEP_QC_USED_ITEM


* Unable to pickup in given slot


* Seller wants pickup beyond cut off time



### Cancelled Status Exception Remarks

* Cancelled by customer


* Cancelled by Client


* Third Successful Attempt


* Cancelled as per client's request


* Central Ops Queued Return



### Not Attempted Exception Remarks

* Not Attempted


* Vehicle Breakdown


* Heavy Rain



---

## 7. Operational Technical Support

* **API Engineering Support Queue Email:** `ecom.techsupport@shadowfax.in`

* **Live Client Integration Issues Sheet:** [Google Sheets Troubleshooting Assistant](https://docs.google.com/spreadsheets/d/1c7EfdwrxQrqz9zhwaa4bE0dI0EI41PT5ynY74aDJ7S8/edit#gid=1815509323)


---

*Manual compiled successfully. Use your browser's print utility to create a PDF.*