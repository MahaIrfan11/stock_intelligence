def test_create_stock_item(client, sample_item):
    r = client.post("/api/stock", json=sample_item())
    assert r.status_code == 201
    body = r.json()
    assert body["supplier"] == "Acme Metals"
    assert body["currency"] == "AED"
    assert body["id"] > 0


def test_create_rejects_invalid_payloads(client, sample_item):
    assert client.post("/api/stock", json=sample_item(quantity=0)).status_code == 422
    assert client.post("/api/stock", json=sample_item(currency="XYZ")).status_code == 422
    assert client.post("/api/stock", json=sample_item(purchase_price=-1)).status_code == 422
    assert client.post("/api/stock", json=sample_item(received_date="2099-01-01")).status_code == 422
    assert client.post("/api/stock", json=sample_item(supplier="  ")).status_code == 422


def test_list_filtering_and_pagination(client, sample_item):
    for i in range(5):
        client.post("/api/stock", json=sample_item(supplier=f"S{i}", purchase_price=10 + i))

    body = client.get("/api/stock", params={"page": 1, "page_size": 2}).json()
    assert body["total"] == 5
    assert body["pages"] == 3
    assert len(body["items"]) == 2

    assert client.get("/api/stock", params={"min_price": 12}).json()["total"] == 3
    assert client.get("/api/stock", params={"supplier": "s1"}).json()["total"] == 1


def test_list_by_supplier(client, sample_item):
    client.post("/api/stock", json=sample_item(supplier="Acme Metals"))
    client.post("/api/stock", json=sample_item(supplier="Other Co"))

    body = client.get("/api/stock/Acme Metals").json()
    assert body["total"] == 1
    assert body["items"][0]["supplier"] == "Acme Metals"


def test_facets(client, sample_item):
    client.post("/api/stock", json=sample_item())
    assert client.get("/api/stock/facets").json()["product_types"] == ["Copper Wire"]


def test_free_text_search(client, sample_item):
    client.post("/api/stock", json=sample_item(supplier="Acme Metals", product_type="Copper Wire"))
    client.post("/api/stock", json=sample_item(supplier="Gulf Traders", product_type="PVC Pipe"))

    assert client.get("/api/stock", params={"q": "copper"}).json()["total"] == 1
    assert client.get("/api/stock", params={"q": "gulf"}).json()["total"] == 1
    assert client.get("/api/stock", params={"q": "dubai"}).json()["total"] == 2


def test_identical_lot_is_refused_with_409(client, sample_item):
    assert client.post("/api/stock", json=sample_item()).status_code == 201

    r = client.post("/api/stock", json=sample_item())
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert detail["code"] == "duplicate_stock_item"
    assert detail["existing"]["supplier"] == "Acme Metals"
    assert client.get("/api/stock").json()["total"] == 1


def test_duplicate_can_be_confirmed(client, sample_item):
    client.post("/api/stock", json=sample_item())

    r = client.post("/api/stock", json=sample_item(), params={"allow_duplicate": "true"})
    assert r.status_code == 201
    assert client.get("/api/stock").json()["total"] == 2


def test_lots_differing_in_any_field_are_not_duplicates(client, sample_item):
    client.post("/api/stock", json=sample_item())
    assert client.post("/api/stock", json=sample_item(quantity=101)).status_code == 201
    assert client.post("/api/stock", json=sample_item(location="Sharjah")).status_code == 201
    assert client.post("/api/stock", json=sample_item(received_date="2026-08-02")).status_code == 201
