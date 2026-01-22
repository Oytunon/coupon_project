def test_get_stats(client):
    response = client.get("/admin/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_participants" in data
    assert "total_coupons" in data
    assert "today_coupons" in data
    assert "pending_coupons" in data

def test_list_participants(client):
    response = client.get("/admin/participants")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
