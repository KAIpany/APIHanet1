# Hanet API Integration

## Quy tắc ghép cặp Check-in/Check-out

Hệ thống áp dụng logic ghép cặp check-in/check-out theo các nguyên tắc sau:

### Nguyên tắc chung:
1. Các sự kiện check-in/check-out được xác định bởi API Hanet
2. Hệ thống sắp xếp các sự kiện theo thời gian tăng dần
3. Mỗi người dùng trong mỗi ngày có nhiều lần check-in/check-out

### Quy tắc ghép cặp:
1. **Ghép từng cặp tuần tự**: Hệ thống ghép các sự kiện thành từng cặp theo trình tự thời gian
   - Sự kiện đầu tiên = check-in
   - Sự kiện thứ hai = check-out
   - Sự kiện thứ ba = check-in tiếp theo
   - Sự kiện thứ tư = check-out tiếp theo
   - Và tiếp tục...

2. **Trường hợp đặc biệt**:
   - Nếu tổng số sự kiện là số lẻ, sự kiện cuối cùng sẽ là check-in và không có check-out tương ứng
   - Check-out = null khi không có sự kiện check-out

3. **Tính thời gian làm việc**:
   - Có cả check-in và check-out: `workingTime = thời gian check-out - thời gian check-in`
   - Không có check-out: `workingTime = "N/A"`
   - Check-in và check-out trùng thời gian: `workingTime = "0h 0m"`

### Ví dụ:

**Input**: 3 sự kiện của người dùng A trong ngày 2025-05-07:
```
- Event 1: 15:14:18 - Người A check-in
- Event 2: 17:30:45 - Người A check-in/out
- Event 3: 19:03:06 - Người A check-in/out
```

**Output**: 2 bản ghi
```
- Record 1: check-in=15:14:18, check-out=17:30:45, workingTime="2h 16m"  
- Record 2: check-in=19:03:06, check-out=null, workingTime="N/A"
```

### Đồng nhất giữa Frontend và API

Logic xử lý này được áp dụng đồng nhất giữa:
- API: Xử lý dữ liệu thô từ Hanet và trả về cặp check-in/check-out
- Frontend: Hiển thị dữ liệu theo cùng cách ghép cặp

Điều này đảm bảo người dùng thấy dữ liệu nhất quán trên giao diện và khi truy vấn API. 