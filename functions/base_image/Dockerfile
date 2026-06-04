FROM public.ecr.aws/lambda/python:3.11 AS builder

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --target /install

FROM public.ecr.aws/lambda/python:3.11

COPY --from=builder /install ${LAMBDA_TASK_ROOT}

CMD ["handler.handle"]